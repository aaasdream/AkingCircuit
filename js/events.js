import { svg, state, circuit, gridSize, svgNS, elementCounter } from './state.js';
import { updateViewBox, getSvgCoords, snapToGrid, findNearestTerminal, findNearestWire, findNearestNode, render, isPathColliding } from './canvas.js';
import { createComponentData, getComponentSVG, updateComponentTerminals } from './components.js';
import { updateButtonStates, updatePropertiesPanel } from './ui.js';

let ghostComponent = null;
let tempWireEl = null;
let marqueeRect = null;

function setMode(newMode, options = {}) {
    if (ghostComponent) { ghostComponent.remove(); ghostComponent = null; }
    if (tempWireEl) { tempWireEl.remove(); tempWireEl = null; }
    state.mode = newMode;
    state.placingType = options.placingType || null;
    state.selectedComponentIds = [];
    state.selectedWireIds = [];
    state.selectedNodeKeys = [];
    state.ghostRotation = 0;
    state.currentWirePoints = [];
    if (state.mode === 'PLACING' && state.placingType) {
        ghostComponent = document.createElementNS(svgNS, 'g');
        ghostComponent.innerHTML = getComponentSVG(state.placingType);
        ghostComponent.classList.add('ghost');
        svg.appendChild(ghostComponent);
    }
    const cursors = { 'SELECT': 'default', 'WIRING': 'crosshair', 'PLACING': 'crosshair' };
    svg.style.cursor = cursors[state.mode] || 'default';
    updateButtonStates();
    updatePropertiesPanel();
}

function createJunctionOnWire(snapPoint) {
    if (!snapPoint || !snapPoint.wire) return null;

    const originalWire = circuit.wires.find(w => w.id === snapPoint.wire.wireId);
    if (!originalWire) return null;

    const segmentStartPoint = snapPoint.wire.segment[0];
    const segmentEndPoint = snapPoint.wire.segment[1];
    const segmentStartIndex = originalWire.points.findIndex(p => p.x === segmentStartPoint.x && p.y === segmentStartPoint.y);

    if (segmentStartIndex > -1 && segmentStartIndex < originalWire.points.length - 1 &&
        originalWire.points[segmentStartIndex + 1].x === segmentEndPoint.x &&
        originalWire.points[segmentStartIndex + 1].y === segmentEndPoint.y) {

        const newJunctionPoint = { x: snapPoint.x, y: snapPoint.y, isNode: true };

        const points1 = originalWire.points.slice(0, segmentStartIndex + 1);
        points1.push(newJunctionPoint);
        const points2 = [newJunctionPoint, ...originalWire.points.slice(segmentStartIndex + 1)];

        circuit.wires = circuit.wires.filter(w => w.id !== originalWire.id);
        circuit.wires.push({ id: `w${++elementCounter.W}`, points: points1 });
        circuit.wires.push({ id: `w${++elementCounter.W}`, points: points2 });

        return newJunctionPoint;
    }
    return null;
}

function onMouseDown(e) {
    if (e.button === 1) { // 中鍵平移
        state.isPanning = true; state.panStart = { x: e.clientX, y: e.clientY };
        svg.style.cursor = 'grabbing';
        return;
    }
    if (e.button === 2) { // 右鍵
        e.preventDefault();
        if (state.mode === 'WIRING' && state.currentWirePoints.length > 0) {
            finalizeCurrentWire();
            setMode('SELECT');
        }
        return;
    }
    if (e.button !== 0) return; // 只處理左鍵

    if (state.mode === 'PLACING') {
        const { x, y } = getSvgCoords(e);
        const snappedX = snapToGrid(x, gridSize);
        const snappedY = snapToGrid(y, gridSize);
        const newComp = createComponentData(state.placingType, snappedX, snappedY);
        newComp.rotation = state.ghostRotation;
        updateComponentTerminals(newComp);
        circuit.components.push(newComp);
        render();
        if (state.mode === 'PLACING' && state.placingType) {
            if (ghostComponent) ghostComponent.remove();
            ghostComponent = document.createElementNS(svgNS, 'g');
            ghostComponent.innerHTML = getComponentSVG(state.placingType);
            ghostComponent.classList.add('ghost');
            svg.appendChild(ghostComponent);
            onMouseMove(e);
        }

    } else if (state.mode === 'WIRING') {
        const { snapPoint, connected } = getWireSnapPoint(e);
        let newPoint; 

        if (snapPoint.node) {
            newPoint = snapPoint.node.point;
        } else if (snapPoint.terminal) {
            newPoint = { x: snapPoint.x, y: snapPoint.y, terminal: snapPoint.terminal };
        } else if (snapPoint.wire) {
            newPoint = createJunctionOnWire(snapPoint);
        } else {
            newPoint = { x: snapPoint.x, y: snapPoint.y, isNode: true };
        }
        
        if (!newPoint) return;

        const isFirstPoint = state.currentWirePoints.length === 0;
        state.currentWirePoints.push(newPoint);

        if (isFirstPoint) {
            tempWireEl = document.createElementNS(svgNS, 'polyline');
            tempWireEl.classList.add('wire');
            tempWireEl.style.opacity = '0.7';
            svg.appendChild(tempWireEl);
        }

        if (!isFirstPoint && (snapPoint.terminal || snapPoint.node)) {
            finalizeCurrentWire();
            setMode('SELECT');
        } else {
            onMouseMove(e);
        }

    } else if (state.mode === 'SELECT') {
        // --- 【核心修改】統一拖曳邏輯 ---
        const { x, y } = getSvgCoords(e);
        const clickedVertexHandle = e.target.closest('.wire-vertex-handle');
        const clickedComponent = e.target.closest('.component');
        const clickedWire = e.target.closest('.wire');

        // 1. 判斷點擊的目標是否已經在選取集合中
        let clickedComponentId = clickedComponent ? clickedComponent.dataset.id : null;
        let nodeKey = null;
        if (clickedVertexHandle) {
            const handleX = parseFloat(clickedVertexHandle.getAttribute('x')) + parseFloat(clickedVertexHandle.getAttribute('width')) / 2;
            const handleY = parseFloat(clickedVertexHandle.getAttribute('y')) + parseFloat(clickedVertexHandle.getAttribute('height')) / 2;
            nodeKey = `${handleX},${handleY}`;
        }
        
        const isComponentSelected = clickedComponentId && state.selectedComponentIds.includes(clickedComponentId);
        const isNodeSelected = nodeKey && state.selectedNodeKeys.includes(nodeKey);
        
        // 2. 如果是，則無論點到的是元件還是節點，都立即啟動「群組拖曳」
        if (isComponentSelected || isNodeSelected) {
            state.isDragging = true;
            state.dragStart = { x, y };

            // 記錄所有選取物件的初始位置
            state.componentDragStartPositions.clear();
            state.selectedComponentIds.forEach(id => {
                const comp = circuit.components.find(c => c.id === id);
                if (comp) state.componentDragStartPositions.set(id, { x: comp.x, y: comp.y });
            });
            state.draggingNodesInfo = [];
            state.selectedNodeKeys.forEach(key => {
                const [keyX, keyY] = key.split(',').map(parseFloat);
                circuit.wires.forEach(wire => {
                    wire.points.forEach((point, index) => {
                        if (point.x === keyX && point.y === keyY) {
                            state.draggingNodesInfo.push({
                                pointRef: point, // 直接儲存物件參考
                                startX: point.x,
                                startY: point.y
                            });
                        }
                    });
                });
            });
            return; // 啟動拖曳後，結束 mousedown 處理
        }

        // 3. 如果不是，則執行「變更選取」的邏輯
        // 如果點在空白處，開始框選
        if (!clickedComponent && !clickedWire && !clickedVertexHandle) {
            state.isMarqueeSelecting = true;
            state.marqueeStart = getSvgCoords(e);
            if (!e.shiftKey) {
                state.selectedComponentIds = [];
                state.selectedWireIds = [];
                state.selectedNodeKeys = [];
            }
            render();
            marqueeRect = document.createElementNS(svgNS, 'rect');
            marqueeRect.classList.add('marquee-rect');
            svg.appendChild(marqueeRect);
            return;
        }

        // 如果點在物件上，根據是否按住 Shift 來更新選取
        if (!e.shiftKey) {
            state.selectedComponentIds = [];
            state.selectedWireIds = [];
            state.selectedNodeKeys = [];
        }

        // 切換元件的選取狀態
        if (clickedComponentId) {
            const index = state.selectedComponentIds.indexOf(clickedComponentId);
            if (index > -1) state.selectedComponentIds.splice(index, 1);
            else state.selectedComponentIds.push(clickedComponentId);
        }
        // 切換節點的選取狀態
        if (nodeKey) {
            const index = state.selectedNodeKeys.indexOf(nodeKey);
            if (index > -1) state.selectedNodeKeys.splice(index, 1);
            else state.selectedNodeKeys.push(nodeKey);
        }
        // 切換導線的選取狀態
        let clickedWireId = clickedWire ? clickedWire.dataset.id : null;
        if (clickedWireId) {
            const index = state.selectedWireIds.indexOf(clickedWireId);
            if (index > -1) state.selectedWireIds.splice(index, 1);
            else state.selectedWireIds.push(clickedWireId);
        }
        
        updatePropertiesPanel();
        render();
    }
}

function onMouseMove(e) {
    if (state.isMarqueeSelecting) {
        const currentPos = getSvgCoords(e);
        const sx = Math.min(state.marqueeStart.x, currentPos.x);
        const sy = Math.min(state.marqueeStart.y, currentPos.y);
        const sw = Math.abs(state.marqueeStart.x - currentPos.x);
        const sh = Math.abs(state.marqueeStart.y - currentPos.y);

        marqueeRect.setAttribute('x', sx);
        marqueeRect.setAttribute('y', sy);
        marqueeRect.setAttribute('width', sw);
        marqueeRect.setAttribute('height', sh);
        return; 
    }

    if (state.isPanning) {
        const dx = e.clientX - state.panStart.x, dy = e.clientY - state.panStart.y;
        const zoomFactor = state.viewBox.w / svg.clientWidth;
        state.viewBox.x -= dx * zoomFactor; state.viewBox.y -= dy * zoomFactor;
        state.panStart = { x: e.clientX, y: e.clientY };
        updateViewBox();
        return;
    }
    
    // 【核心修改】移除舊的 draggingVertexInfo 邏輯，所有拖曳都由 isDragging 處理
    if (state.isDragging) {
        const { x, y } = getSvgCoords(e);
        const dx = x - state.dragStart.x;
        const dy = y - state.dragStart.y;

        // 移動所有選中的元件
        state.selectedComponentIds.forEach(id => {
            const comp = circuit.components.find(c => c.id === id);
            const startPos = state.componentDragStartPositions.get(id);
            if (comp && startPos) {
                comp.x = startPos.x + dx;
                comp.y = startPos.y + dy;
                updateComponentTerminals(comp);
            }
        });
        
        // 移動所有選中的節點
        if (state.draggingNodesInfo) {
            state.draggingNodesInfo.forEach(info => {
                info.pointRef.x = info.startX + dx;
                info.pointRef.y = info.startY + dy;
            });
        }
        render();
        return;
    }
    
    if (state.mode === 'PLACING' && ghostComponent) {
        const { x, y } = getSvgCoords(e);
        const snappedX = snapToGrid(x, gridSize);
        const snappedY = snapToGrid(y, gridSize);
        ghostComponent.setAttribute('transform', `translate(${snappedX}, ${snappedY}) rotate(${state.ghostRotation})`);
    } else if (state.mode === 'WIRING' && tempWireEl && state.currentWirePoints.length > 0) {
        const { snapPoint } = getWireSnapPoint(e);
        const previewPoints = [...state.currentWirePoints, snapPoint];
        tempWireEl.setAttribute('points', previewPoints.map(p => `${p.x},${p.y}`).join(' '));
    }
}

function getWireSnapPoint(e) {
    const { x, y } = getSvgCoords(e);
    const snappedX = snapToGrid(x, gridSize);
    const snappedY = snapToGrid(y, gridSize);
    let snapPoint = { x: snappedX, y: snappedY };
    let connected = false;

    const nearestTerminal = findNearestTerminal(x, y, 10);
    const nearestNode = findNearestNode(x, y, 10);
    const nearestWire = findNearestWire(x, y, 10);

    if (nearestTerminal) {
        snapPoint = { x: nearestTerminal.x, y: nearestTerminal.y, terminal: { componentId: nearestTerminal.componentId, terminalId: nearestTerminal.terminalId } };
        connected = true;
    } else if (nearestNode) {
        snapPoint = { x: nearestNode.point.x, y: nearestNode.point.y, node: nearestNode };
        connected = true;
    } else if (nearestWire) {
        snapPoint = { x: nearestWire.x, y: nearestWire.y, wire: nearestWire };
        connected = true;
    }
    return { snapPoint, connected };
}

function finalizeCurrentWire() {
    if (state.currentWirePoints.length >= 2) {
        circuit.wires.push({
            id: `w${++elementCounter.W}`,
            points: state.currentWirePoints
        });
    }
    state.currentWirePoints = [];
    if (tempWireEl) { tempWireEl.remove(); tempWireEl = null; }
    render();
}

function onMouseUp(e) {
    if (state.isMarqueeSelecting) {
        const finalPos = getSvgCoords(e);
        const sx = Math.min(state.marqueeStart.x, finalPos.x);
        const sy = Math.min(state.marqueeStart.y, finalPos.y);
        const sw = Math.abs(state.marqueeStart.x - finalPos.x);
        const sh = Math.abs(state.marqueeStart.y - finalPos.y);

        const selectedComponentIds = new Set(state.selectedComponentIds);
        const selectedWireIds = new Set(state.selectedWireIds);
        const selectedNodeKeys = new Set(state.selectedNodeKeys);

        circuit.components.forEach(comp => {
            if (comp.x >= sx && comp.x <= sx + sw && comp.y >= sy && comp.y <= sy + sh) {
                selectedComponentIds.add(comp.id);
            }
        });
        circuit.wires.forEach(wire => {
            const isAnyPointInside = wire.points.some(p => p.x >= sx && p.x <= sx + sw && p.y >= sy && p.y <= sy + sh);
            if (isAnyPointInside) {
                selectedWireIds.add(wire.id);
            }
            wire.points.forEach(p => {
                if (p.isNode && p.x >= sx && p.x <= sx + sw && p.y >= sy && p.y <= sy + sh) {
                    selectedNodeKeys.add(`${p.x},${p.y}`);
                }
            });
        });

        state.selectedComponentIds = Array.from(selectedComponentIds);
        state.selectedWireIds = Array.from(selectedWireIds);
        state.selectedNodeKeys = Array.from(selectedNodeKeys);

        state.isMarqueeSelecting = false;
        if (marqueeRect) {
            marqueeRect.remove();
            marqueeRect = null;
        }
        updatePropertiesPanel();
        render(); 
    }

    if (e.button === 1) {
        state.isPanning = false;
        const cursors = { 'SELECT': 'default', 'WIRING': 'crosshair', 'PLACING': 'crosshair' };
        svg.style.cursor = cursors[state.mode] || 'default';
    }
    
    // 【核心修改】結束拖曳時，對齊網格並更新節點 keys
    if (state.isDragging) {
        state.isDragging = false;
        
        state.selectedComponentIds.forEach(id => {
            const comp = circuit.components.find(c => c.id === id);
            if(comp) {
                comp.x = snapToGrid(comp.x, gridSize);
                comp.y = snapToGrid(comp.y, gridSize);
                updateComponentTerminals(comp);
            }
        });

        if (state.draggingNodesInfo) {
            const finalNodeKeys = new Set();
            state.draggingNodesInfo.forEach(info => {
                info.pointRef.x = snapToGrid(info.pointRef.x, gridSize);
                info.pointRef.y = snapToGrid(info.pointRef.y, gridSize);
                finalNodeKeys.add(`${info.pointRef.x},${info.pointRef.y}`);
            });
            // 確保 selectedNodeKeys 與節點的最終位置同步
            state.selectedNodeKeys = Array.from(finalNodeKeys);
        }
        
        state.draggingNodesInfo = null;
        render();
    }
}

function onContextMenu(e) {
    e.preventDefault();
    if (state.mode === 'PLACING') {
        state.ghostRotation = (state.ghostRotation + 90) % 360;
        onMouseMove(e);
    }
}

function onWheel(e) {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const { x, y } = getSvgCoords(e);
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoomIntensity);
    state.viewBox.x -= (x - state.viewBox.x) * (zoom - 1);
    state.viewBox.y -= (y - state.viewBox.y) * (zoom - 1);
    state.viewBox.w *= zoom; state.viewBox.h *= zoom;
    updateViewBox();
}

function onKeyDown(e) {
    if (e.key === 'Escape') {
        if (state.mode === 'WIRING' && state.currentWirePoints.length > 0) {
            finalizeCurrentWire();
            setMode('SELECT');
        } else {
            setMode('SELECT');
        }
    }
    if (e.key.toLowerCase() === 'r' && state.selectedComponentIds.length > 0) {
        state.selectedComponentIds.forEach(id => {
            const comp = circuit.components.find(c => c.id === id);
            if (comp) {
                comp.rotation = (comp.rotation + 90) % 360;
                updateComponentTerminals(comp);
            }
        });
        render();
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        let anythingDeleted = false;

        if (state.selectedNodeKeys.length > 0) {
            const nodeKeysToDelete = new Set(state.selectedNodeKeys);
            circuit.wires.forEach(wire => {
                const originalLength = wire.points.length;
                wire.points = wire.points.filter(p => !(p.isNode && nodeKeysToDelete.has(`${p.x},${p.y}`)));
                if (wire.points.length !== originalLength) {
                    anythingDeleted = true;
                }
            });
            circuit.wires = circuit.wires.filter(wire => wire.points.length >= 2);
            state.selectedNodeKeys = [];
        }

        if (state.selectedComponentIds.length > 0) {
            circuit.components = circuit.components.filter(
                comp => !state.selectedComponentIds.includes(comp.id)
            );
            state.selectedComponentIds = [];
            anythingDeleted = true;
        }
        if (state.selectedWireIds.length > 0) {
            circuit.wires = circuit.wires.filter(
                wire => !state.selectedWireIds.includes(wire.id)
            );
            state.selectedWireIds = [];
            anythingDeleted = true;
        }
        
        if (anythingDeleted) {
            updatePropertiesPanel();
            render();
        }
    }
}

export function setupEventListeners() {
    document.querySelectorAll('.component-btn[data-type]').forEach(btn => {
        btn.addEventListener('click', () => setMode('PLACING', { placingType: btn.dataset.type }));
    });
    document.getElementById('select-tool-btn').addEventListener('click', () => setMode('SELECT'));
    document.getElementById('wire-tool-btn').addEventListener('click', () => setMode('WIRING'));
    document.getElementById('simulate-btn').addEventListener('click', () => import('./simulation.js').then(sim => sim.runSimulation()));

    svg.addEventListener('mousedown', onMouseDown);
    svg.addEventListener('mousemove', onMouseMove);
    svg.addEventListener('mouseup', onMouseUp);
    svg.addEventListener('wheel', onWheel);
    svg.addEventListener('contextmenu', onContextMenu);
    svg.addEventListener('mouseleave', () => {
        if (state.isPanning) state.isPanning = false;
        if (state.isDragging) onMouseUp({button: 0});
        if (state.isMarqueeSelecting) {
            state.isMarqueeSelecting = false;
            if (marqueeRect) {
                marqueeRect.remove();
                marqueeRect = null;
            }
            render();
        }
    });
    window.addEventListener('keydown', onKeyDown);
}
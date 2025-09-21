import { svg, state, circuit, gridSize, svgNS, elementCounter } from './state.js';
import { updateViewBox, getSvgCoords, snapToGrid, findNearestTerminal, findNearestWire, render, isPathColliding } from './canvas.js';
import { createComponentData, getComponentSVG, updateComponentTerminals } from './components.js';
import { updateButtonStates, updatePropertiesPanel } from './ui.js';

let ghostComponent = null;
let tempWireEl = null;


/**
 * 產生正交路徑的預覽點。這些點僅用於視覺預覽，不包含節點資訊。
 * @param {object} startPoint - 起始點 {x, y}
 * @param {object} endPoint - 結束點 {x, y}
 * @returns {Array<object>} - 組成路徑的點陣列
 */
function getOrthogonalPreviewPoints(startPoint, endPoint) {
    if (startPoint.x === endPoint.x || startPoint.y === endPoint.y) {
        state.wireDirection = 'UNDETERMINED';
        return [startPoint, endPoint];
    }
    
    const intermediate1 = { x: endPoint.x, y: startPoint.y };
    const intermediate2 = { x: startPoint.x, y: endPoint.y };
    
    if (state.wireDirection === 'HORIZONTAL') {
        return [startPoint, intermediate1, endPoint];
    } 
    if (state.wireDirection === 'VERTICAL') {
        return [startPoint, intermediate2, endPoint];
    }
    
    const dx = Math.abs(startPoint.x - endPoint.x);
    const dy = Math.abs(startPoint.y - endPoint.y);
    return dx > dy 
        ? [startPoint, intermediate1, endPoint]
        : [startPoint, intermediate2, endPoint];
}


function setMode(newMode, options = {}) {
    if (ghostComponent) { ghostComponent.remove(); ghostComponent = null; }
    if (tempWireEl) { tempWireEl.remove(); tempWireEl = null; }
    state.mode = newMode;
    state.placingType = options.placingType || null;
    state.selectedComponentIds = [];
    state.selectedWireIds = [];
    state.selectedNodeKey = null;
    state.ghostRotation = 0;
    state.currentWirePoints = [];
    state.wireDirection = 'UNDETERMINED';
    state.wireLastMovePoint = null;
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

function onMouseDown(e) {
    if (e.button === 1) { // 中鍵平移
        state.isPanning = true; state.panStart = { x: e.clientX, y: e.clientY };
        svg.style.cursor = 'grabbing';
        return;
    }
    if (e.button === 2) { // 右鍵取消
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

        if (state.currentWirePoints.length === 0) {
            // 【畫線起點】
            state.currentWirePoints.push(snapPoint);
            tempWireEl = document.createElementNS(svgNS, 'polyline');
            tempWireEl.classList.add('wire');
            tempWireEl.style.opacity = '0.7';
            svg.appendChild(tempWireEl);
        } else {
            // 【畫線中點或終點】
            const lastPoint = state.currentWirePoints[0];
            let nextStartPoint = snapPoint;

            if (snapPoint.wire) {
                const newJunctionPoint = { x: snapPoint.x, y: snapPoint.y, isNode: true };
                nextStartPoint = newJunctionPoint;

                const originalWire = circuit.wires.find(w => w.id === snapPoint.wire.wireId);
                const segmentStartPoint = snapPoint.wire.segment[0];
                
                if(originalWire) {
                    const segmentStartIndex = originalWire.points.findIndex(p => p.x === segmentStartPoint.x && p.y === segmentStartPoint.y);
                    circuit.wires = circuit.wires.filter(w => w.id !== originalWire.id);
                    
                    const points1 = originalWire.points.slice(0, segmentStartIndex + 1);
                    points1.push(newJunctionPoint);
                    circuit.wires.push({ id: `w${++elementCounter.W}`, points: points1 });
                    
                    const points2 = [newJunctionPoint, ...originalWire.points.slice(segmentStartIndex + 1)];
                    circuit.wires.push({ id: `w${++elementCounter.W}`, points: points2 });
                }
            }
            
            const pointsForCurrentSegment = getOrthogonalPreviewPoints(lastPoint, snapPoint);
            circuit.wires.push({ id: `w${++elementCounter.W}`, points: pointsForCurrentSegment });
            
            // 【核心修正】調整執行順序
            // 1. 移除舊的預覽線
            if (tempWireEl) {
                tempWireEl.remove();
                tempWireEl = null;
            }
            
            // 2. 渲染所有永久線段
            render(); 

            // 3. 根據情況決定下一步
            if (connected) {
                // 如果連接完成，就結束畫線
                finalizeCurrentWire();
                setMode('SELECT');
            } else {
                // 如果是在空白處點擊，則準備開始畫下一段
                nextStartPoint.isNode = true; 
                state.currentWirePoints = [nextStartPoint];
                state.wireDirection = 'UNDETERMINED';
                
                // 4. 在所有永久線段都畫好之後，才建立新的預覽線
                tempWireEl = document.createElementNS(svgNS, 'polyline');
                tempWireEl.classList.add('wire');
                tempWireEl.style.opacity = '0.7';
                svg.appendChild(tempWireEl);
                onMouseMove(e);
            }
        }

    } else if (state.mode === 'SELECT') {
        const clickedVertexHandle = e.target.closest('.wire-vertex-handle');

        if (clickedVertexHandle) {
            e.stopPropagation();
            const handleX = parseFloat(clickedVertexHandle.getAttribute('x')) + parseFloat(clickedVertexHandle.getAttribute('width')) / 2;
            const handleY = parseFloat(clickedVertexHandle.getAttribute('y')) + parseFloat(clickedVertexHandle.getAttribute('height')) / 2;
            const nodeKey = `${handleX},${handleY}`;

            if (state.selectedNodeKey === nodeKey) {
                const targetPoints = [];
                circuit.wires.forEach(wire => {
                    wire.points.forEach((point, index) => {
                        if (point.x === handleX && point.y === handleY && point.isNode) {
                            targetPoints.push({ wireId: wire.id, pointIndex: index });
                        }
                    });
                });
                if (targetPoints.length > 0) {
                    state.draggingVertexInfo = {
                        targets: targetPoints,
                        originalX: handleX,
                        originalY: handleY
                    };
                }
            } else {
                state.selectedComponentIds = [];
                state.selectedWireIds = [];
                state.selectedNodeKey = nodeKey;
            }
        } else {
            const { x, y } = getSvgCoords(e);
            const clickedComponent = e.target.closest('.component');
            const clickedComponentId = clickedComponent ? clickedComponent.dataset.id : null;
            const clickedWire = e.target.closest('.wire');
            const clickedWireId = clickedWire ? clickedWire.dataset.id : null;

            if (clickedComponentId && state.selectedComponentIds.includes(clickedComponentId)) {
                state.isDragging = true;
                state.dragStart = { x, y };
                state.componentDragStartPositions.clear();
                state.selectedComponentIds.forEach(id => {
                    const comp = circuit.components.find(c => c.id === id);
                    if (comp) state.componentDragStartPositions.set(id, { x: comp.x, y: comp.y });
                });
                return;
            }

            if (e.shiftKey) {
                if (clickedComponentId) {
                    const index = state.selectedComponentIds.indexOf(clickedComponentId);
                    if (index > -1) state.selectedComponentIds.splice(index, 1);
                    else state.selectedComponentIds.push(clickedComponentId);
                }
                if (clickedWireId) {
                    const index = state.selectedWireIds.indexOf(clickedWireId);
                    if (index > -1) state.selectedWireIds.splice(index, 1);
                    else state.selectedWireIds.push(clickedWireId);
                }
            } else {
                state.selectedComponentIds = clickedComponentId ? [clickedComponentId] : [];
                state.selectedWireIds = clickedWireId ? [clickedWireId] : [];
                state.selectedNodeKey = null;
            }
        }
        
        updatePropertiesPanel();
        render();
    }
}

function onMouseMove(e) {
    if (state.isPanning) {
        const dx = e.clientX - state.panStart.x, dy = e.clientY - state.panStart.y;
        const zoomFactor = state.viewBox.w / svg.clientWidth;
        state.viewBox.x -= dx * zoomFactor; state.viewBox.y -= dy * zoomFactor;
        state.panStart = { x: e.clientX, y: e.clientY };
        updateViewBox();
        return;
    }
    
    if (state.draggingVertexInfo && state.draggingVertexInfo.targets) {
        const { x, y } = getSvgCoords(e);
        const snappedX = snapToGrid(x, gridSize);
        const snappedY = snapToGrid(y, gridSize);
        const { originalX, originalY } = state.draggingVertexInfo;

        if (snappedX === originalX && snappedY === originalY) return;
        
        state.draggingVertexInfo.targets.forEach(target => {
            const wire = circuit.wires.find(w => w.id === target.wireId);
            if (!wire) return;
            const point = wire.points[target.pointIndex];
            point.x = snappedX;
            point.y = snappedY;
        });
        
        state.draggingVertexInfo.originalX = snappedX;
        state.draggingVertexInfo.originalY = snappedY;
        state.selectedNodeKey = `${snappedX},${snappedY}`;
        render();
        return;
    }

    if (state.isDragging) {
        const { x, y } = getSvgCoords(e);
        const dx = x - state.dragStart.x, dy = y - state.dragStart.y;
        state.selectedComponentIds.forEach(id => {
            const comp = circuit.components.find(c => c.id === id);
            const startPos = state.componentDragStartPositions.get(id);
            if (comp && startPos) {
                comp.x = startPos.x + dx;
                comp.y = startPos.y + dy;
                updateComponentTerminals(comp);
            }
        });
        render();
        return;
    }
    
    if (state.mode === 'PLACING' && ghostComponent) {
        const { x, y } = getSvgCoords(e);
        const snappedX = snapToGrid(x, gridSize);
        const snappedY = snapToGrid(y, gridSize);
        ghostComponent.setAttribute('transform', `translate(${snappedX}, ${snappedY}) rotate(${state.ghostRotation})`);
    } else if (state.mode === 'WIRING' && tempWireEl && state.currentWirePoints.length > 0) {
        const lastPoint = state.currentWirePoints[0];
        const { snapPoint } = getWireSnapPoint(e);
        
        if (state.wireDirection === 'UNDETERMINED') {
            const dx = Math.abs(snapPoint.x - lastPoint.x);
            const dy = Math.abs(snapPoint.y - lastPoint.y);
            if (dx > gridSize / 2 || dy > gridSize / 2) {
                state.wireDirection = dx > dy ? 'HORIZONTAL' : 'VERTICAL';
            }
        }
        
        const previewPoints = getOrthogonalPreviewPoints(lastPoint, snapPoint);
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
    const nearestWire = findNearestWire(x, y, 10);

    if (nearestTerminal) {
        snapPoint = { x: nearestTerminal.x, y: nearestTerminal.y, terminal: { componentId: nearestTerminal.componentId, terminalId: nearestTerminal.terminalId } };
        connected = true;
    } else if (nearestWire) {
        snapPoint = { x: nearestWire.x, y: nearestWire.y, wire: nearestWire };
        connected = true;
    }
    
    return { snapPoint, connected };
}

function finalizeCurrentWire() {
    state.currentWirePoints = [];
    if (tempWireEl) { tempWireEl.remove(); tempWireEl = null; }
    state.wireDirection = 'UNDETERMINED';
}

function onMouseUp(e) {
    if (e.button === 1) {
        state.isPanning = false;
        const cursors = { 'SELECT': 'default', 'WIRING': 'crosshair', 'PLACING': 'crosshair' };
        svg.style.cursor = cursors[state.mode] || 'default';
    }

    if (state.draggingVertexInfo) {
        state.draggingVertexInfo = null;
        render(); 
    }
    
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

        if (state.selectedNodeKey) {
            const [xStr, yStr] = state.selectedNodeKey.split(',');
            const x = parseFloat(xStr);
            const y = parseFloat(yStr);

            circuit.wires.forEach(wire => {
                const originalLength = wire.points.length;
                wire.points = wire.points.filter(p => !(p.isNode && p.x === x && p.y === y));
                if (wire.points.length !== originalLength) {
                    anythingDeleted = true;
                }
            });
            circuit.wires = circuit.wires.filter(wire => wire.points.length >= 2);
            state.selectedNodeKey = null;
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
    });
    window.addEventListener('keydown', onKeyDown);
}
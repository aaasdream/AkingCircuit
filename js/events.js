import { svg, state, circuit, gridSize, svgNS } from './state.js';
import { updateViewBox, getSvgCoords, snapToGrid, findNearestTerminal, findNearestWire, render, isPathColliding } from './canvas.js';
import { createComponentData, getComponentSVG, updateComponentTerminals } from './components.js';
import { updateButtonStates, updatePropertiesPanel } from './ui.js';

let ghostComponent = null;
let tempWireEl = null;

function setMode(newMode, options = {}) {
    if (ghostComponent) { ghostComponent.remove(); ghostComponent = null; }
    if (tempWireEl) { tempWireEl.remove(); tempWireEl = null; }

    state.mode = newMode;
    state.placingType = options.placingType || null;
    state.selectedComponentIds = [];
    state.selectedWireIds = []; // << 新增：切換模式時取消選取導線
    state.ghostRotation = 0;
    state.currentWirePoints = [];
    state.wireDirection = 'UNDETERMINED';
    
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
    if (e.button === 1) {
        state.isPanning = true; state.panStart = { x: e.clientX, y: e.clientY };
        svg.style.cursor = 'grabbing';
        return;
    }
    if (e.button === 2) {
        if (state.mode === 'WIRING' && state.currentWirePoints.length > 0) {
            e.preventDefault();
            finalizeCurrentWire();
        }
        return;
    }
    if (e.button !== 0) return;

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
        
        // 情況 1: 從一條現有導線上開始畫新線
        if (snapPoint.wire && state.currentWirePoints.length === 0) {
            const originalWire = circuit.wires.find(w => w.id === snapPoint.wire.wireId);
            if (originalWire) {
                const newPoint = { x: snapPoint.x, y: snapPoint.y }; 
                const segmentStartPoint = snapPoint.wire.segment[0];
                const segmentStartIndex = originalWire.points.findIndex(p => p.x === segmentStartPoint.x && p.y === segmentStartPoint.y);
                
                if (segmentStartIndex !== -1) {
                    const pointExists = originalWire.points.some(p => p.x === newPoint.x && p.y === newPoint.y);
                    if (!pointExists) {
                        originalWire.points.splice(segmentStartIndex + 1, 0, newPoint);
                    }
                }
            }
        }
        
        // 統一處理當前正在繪製的導線
        if (state.currentWirePoints.length === 0) {
            state.currentWirePoints.push(snapPoint);
            tempWireEl = document.createElementNS(svgNS, 'polyline');
            tempWireEl.classList.add('wire');
            tempWireEl.style.opacity = '0.7';
            svg.appendChild(tempWireEl);
        } else {
            const lastPoint = state.currentWirePoints[state.currentWirePoints.length - 1];
            let intermediatePoint;

            if (state.wireDirection === 'VERTICAL') {
                intermediatePoint = { x: lastPoint.x, y: snapPoint.y };
            } else { // HORIZONTAL or UNDETERMINED
                intermediatePoint = { x: snapPoint.x, y: lastPoint.y };
            }
            
            if (intermediatePoint.x !== lastPoint.x || intermediatePoint.y !== lastPoint.y) {
                 state.currentWirePoints.push(intermediatePoint);
            }
            state.currentWirePoints.push(snapPoint);
        }

        if (connected && state.currentWirePoints.length > 1) {
            finalizeCurrentWire();
        }
        
        state.wireDirection = 'UNDETERMINED';

    } else if (state.mode === 'SELECT') {
        const { x, y } = getSvgCoords(e);
        
        // 【新增】檢查是否點擊在導線的轉折點控制項上
        const clickedVertexHandle = e.target.closest('.wire-vertex-handle');
        if (clickedVertexHandle) {
            e.stopPropagation(); // 防止觸發下方的其他點擊事件
            state.draggingVertexInfo = {
                wireId: clickedVertexHandle.dataset.wireId,
                pointIndex: parseInt(clickedVertexHandle.dataset.pointIndex, 10)
            };
            return;
        }

        const clickedComponent = e.target.closest('.component');
        const clickedComponentId = clickedComponent ? clickedComponent.dataset.id : null;
        
        // 【新增】檢查是否點擊在導線上
        const clickedWire = e.target.closest('.wire');
        const clickedWireId = clickedWire ? clickedWire.dataset.id : null;

        // 如果點擊到已選中的元件，準備拖曳
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

        // 處理 Shift 多選
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
            // 一般單選
            state.selectedComponentIds = clickedComponentId ? [clickedComponentId] : [];
            state.selectedWireIds = clickedWireId ? [clickedWireId] : [];
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

    const { x, y } = getSvgCoords(e);
    
    // 【新增】處理拖曳導線轉折點的邏輯
    if (state.draggingVertexInfo) {
        const { wireId, pointIndex } = state.draggingVertexInfo;
        const wire = circuit.wires.find(w => w.id === wireId);
        if (!wire) return;

        const points = wire.points;
        const p_curr = points[pointIndex];
        const snappedX = snapToGrid(x, gridSize);
        const snappedY = snapToGrid(y, gridSize);

        if (p_curr.x === snappedX && p_curr.y === snappedY) return; // 避免不必要的重複渲染

        // 更新當前點的座標
        p_curr.x = snappedX;
        p_curr.y = snappedY;
        
        // 為了保持線條的正交性，需要同時更新相鄰點的座標
        const p_prev = points[pointIndex - 1];
        const p_next = points[pointIndex + 1];

        // 判斷前一段是水平還是垂直，並更新對應的座標
        // 假設 p_prev 和 p_next 存在 (因為我們只拖曳中間點)
        if (p_prev.y === p_next.y) { // 如果前後兩點在同一水平線上 (不太可能，但作為防禦)
             p_prev.y = snappedY;
             p_next.x = snappedX;
        } else if (p_prev.x === p_next.x) { // 如果前後兩點在同一垂直線上 (不太可能)
             p_prev.y = snappedY;
             p_next.x = snappedX;
        } else {
            // 最常見的情況：一個 L 型的轉角
            // 我們假設前一段是水平，後一段是垂直，或反之
            // 移動轉折點時，我們讓前一段的 Y 向它對齊，後一段的 X 向它對齊
            p_prev.y = snappedY;
            p_next.x = snappedX;
        }

        render();
        return;
    }


    if (state.isDragging) {
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
        const snappedX = snapToGrid(x, gridSize);
        const snappedY = snapToGrid(y, gridSize);
        ghostComponent.setAttribute('transform', `translate(${snappedX}, ${snappedY}) rotate(${state.ghostRotation})`);
    } else if (state.mode === 'WIRING' && tempWireEl && state.currentWirePoints.length > 0) {
        const lastPoint = state.currentWirePoints[state.currentWirePoints.length - 1];
        const { snapPoint } = getWireSnapPoint(e);
        
        const dx = Math.abs(snapPoint.x - lastPoint.x);
        const dy = Math.abs(snapPoint.y - lastPoint.y);
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        const DIR_LOCK_THRESHOLD = 10;
        const DIR_RESET_RADIUS = gridSize * 1.5;

        if (dist < DIR_RESET_RADIUS) {
            state.wireDirection = 'UNDETERMINED';
        } 
        else if (state.wireDirection === 'UNDETERMINED' && dist > DIR_LOCK_THRESHOLD) {
            state.wireDirection = (dx > dy) ? 'HORIZONTAL' : 'VERTICAL';
        }
        
        let previewPoints = [...state.currentWirePoints];
        
        if (state.wireDirection !== 'UNDETERMINED') {
            const ignoreIds = new Set();
            if (lastPoint.terminal) ignoreIds.add(lastPoint.terminal.componentId);
            if (snapPoint.terminal) ignoreIds.add(snapPoint.terminal.componentId);
            const ignoreIdsArray = Array.from(ignoreIds);

            const pathH_intermediate = { x: snapPoint.x, y: lastPoint.y };
            const pathV_intermediate = { x: lastPoint.x, y: snapPoint.y };

            let preferredPath, alternativePath;

            if (state.wireDirection === 'HORIZONTAL') {
                preferredPath = [lastPoint, pathH_intermediate, snapPoint];
                alternativePath = [lastPoint, pathV_intermediate, snapPoint];
            } else {
                preferredPath = [lastPoint, pathV_intermediate, snapPoint];
                alternativePath = [lastPoint, pathH_intermediate, snapPoint];
            }

            const preferredCollides = isPathColliding(preferredPath, ignoreIdsArray);
            const alternativeCollides = isPathColliding(alternativePath, ignoreIdsArray);

            if (preferredCollides && !alternativeCollides) {
                previewPoints.push(alternativePath[1], alternativePath[2]);
            } else {
                previewPoints.push(preferredPath[1], preferredPath[2]);
            }

        } else {
            previewPoints.push(snapPoint);
        }
        
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
    if (state.currentWirePoints.length < 2) {
        state.currentWirePoints = [];
        if (tempWireEl) { tempWireEl.remove(); tempWireEl = null; }
        return;
    }

    // **【修改處】**
    // 情況 2: 檢查導線的結束點是否連接到另一條導線
    const endPoint = state.currentWirePoints[state.currentWirePoints.length - 1];
    if (endPoint.wire) {
        const originalWire = circuit.wires.find(w => w.id === endPoint.wire.wireId);
        if (originalWire) {
            const newPoint = { x: endPoint.x, y: endPoint.y };
            const segmentStartPoint = endPoint.wire.segment[0];
            const segmentStartIndex = originalWire.points.findIndex(p => p.x === segmentStartPoint.x && p.y === segmentStartPoint.y);

            if (segmentStartIndex !== -1) {
                const pointExists = originalWire.points.some(p => p.x === newPoint.x && p.y === newPoint.y);
                if (!pointExists) {
                    originalWire.points.splice(segmentStartIndex + 1, 0, newPoint);
                }
            }
        }
    }

    const cleanedPoints = state.currentWirePoints.reduce((acc, point) => {
        const last = acc[acc.length - 1];
        if (!last || last.x !== point.x || last.y !== point.y) {
            acc.push(point);
        }
        return acc;
    }, []);

    // 【修復】確保結束點的 terminal 資訊被保留
    const lastOriginalPoint = state.currentWirePoints[state.currentWirePoints.length - 1];
    const lastCleanedPoint = cleanedPoints[cleanedPoints.length - 1];
    if (lastOriginalPoint.terminal && lastCleanedPoint) {
        lastCleanedPoint.terminal = lastOriginalPoint.terminal;
    }

    const newWire = {
        id: `w${circuit.wires.length + 1}`,
        points: cleanedPoints,
    };

    circuit.wires.push(newWire);
    state.currentWirePoints = [];
    if (tempWireEl) { tempWireEl.remove(); tempWireEl = null; }
    render();
}

function onMouseUp(e) {
    if (e.button === 1) {
        state.isPanning = false;
        const cursors = { 'SELECT': 'default', 'WIRING': 'crosshair', 'PLACING': 'crosshair' };
        svg.style.cursor = cursors[state.mode] || 'default';
    }

    // 【新增】結束拖曳導線轉折點
    if (state.draggingVertexInfo) {
        state.draggingVertexInfo = null;
        render(); // 重新渲染以簡化可能產生的共線點
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
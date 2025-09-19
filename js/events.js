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
        const clickedElement = e.target.closest('.component');
        const clickedId = clickedElement ? clickedElement.dataset.id : null;
        
        if (clickedId && state.selectedComponentIds.includes(clickedId)) {
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
            if (clickedId) {
                const index = state.selectedComponentIds.indexOf(clickedId);
                if (index > -1) state.selectedComponentIds.splice(index, 1);
                else state.selectedComponentIds.push(clickedId);
            }
        } else {
            state.selectedComponentIds = clickedId ? [clickedId] : [];
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

    const newWire = {
        id: `w${circuit.wires.length + 1}`,
        points: cleanedPoints,
    };
    
    // 在添加新線之前，檢查與現有線路的交叉點
    processWireIntersections(newWire);
    
    circuit.wires.push(newWire);
    state.currentWirePoints = [];
    if (tempWireEl) { tempWireEl.remove(); tempWireEl = null; }
    render();
}

// 新增函數：處理線路交叉點
function processWireIntersections(newWire) {
    // 對新線路的每個線段，檢查與現有線路的交叉
    for (let i = 0; i < newWire.points.length - 1; i++) {
        const p1 = newWire.points[i];
        const p2 = newWire.points[i + 1];
        const insertions = [];
        
        circuit.wires.forEach(existingWire => {
            for (let j = 0; j < existingWire.points.length - 1; j++) {
                const ep1 = existingWire.points[j];
                const ep2 = existingWire.points[j + 1];
                
                const intersection = findWireIntersection(p1, p2, ep1, ep2);
                if (intersection) {
                    // 檢查交叉點是否已存在於新線中
                    const pointExists = newWire.points.some(p => 
                        p.x === intersection.x && p.y === intersection.y
                    );
                    if (!pointExists) {
                        insertions.push({
                            index: i + 1,
                            point: intersection
                        });
                    }
                    
                    // 也要檢查現有線路是否需要添加交叉點
                    const existingPointExists = existingWire.points.some(p => 
                        p.x === intersection.x && p.y === intersection.y
                    );
                    if (!existingPointExists) {
                        existingWire.points.splice(j + 1, 0, intersection);
                    }
                }
            }
        });
        
        // 按索引倒序插入，避免索引偏移
        insertions.sort((a, b) => b.index - a.index);
        insertions.forEach(ins => {
            newWire.points.splice(ins.index, 0, ins.point);
        });
    }
}

// 輔助函數：找到兩個線段的交點
function findWireIntersection(a1, a2, b1, b2) {
    // 檢查一條是水平線，另一條是垂直線
    const aIsHorizontal = a1.y === a2.y;
    const aIsVertical = a1.x === a2.x;
    const bIsHorizontal = b1.y === b2.y;
    const bIsVertical = b1.x === b2.x;
    
    if ((aIsHorizontal && bIsVertical) || (aIsVertical && bIsHorizontal)) {
        let hLine, vLine;
        
        if (aIsHorizontal && bIsVertical) {
            hLine = { start: a1, end: a2 };
            vLine = { start: b1, end: b2 };
        } else {
            hLine = { start: b1, end: b2 };
            vLine = { start: a1, end: a2 };
        }
        
        // 檢查是否真的相交
        const hMinX = Math.min(hLine.start.x, hLine.end.x);
        const hMaxX = Math.max(hLine.start.x, hLine.end.x);
        const vMinY = Math.min(vLine.start.y, vLine.end.y);
        const vMaxY = Math.max(vLine.start.y, vLine.end.y);
        
        if (vLine.start.x >= hMinX && vLine.start.x <= hMaxX &&
            hLine.start.y >= vMinY && hLine.start.y <= vMaxY) {
            return {
                x: vLine.start.x,
                y: hLine.start.y
            };
        }
    }
    
    return null;
}

function onMouseUp(e) {
    if (e.button === 1) {
        state.isPanning = false;
        const cursors = { 'SELECT': 'default', 'WIRING': 'crosshair', 'PLACING': 'crosshair' };
        svg.style.cursor = cursors[state.mode] || 'default';
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
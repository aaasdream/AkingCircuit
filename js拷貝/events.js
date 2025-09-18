import { svg, state, circuit, gridSize, svgNS } from './state.js';
import { updateViewBox, getSvgCoords, snapToGrid, findNearestTerminal, findNearestWire, render } from './canvas.js';
import { createComponentData, getComponentSVG, updateComponentTerminals } from './components.js';
import { updateButtonStates, updatePropertiesPanel } from './ui.js';

let ghostComponent = null;
let tempWireEl = null; // 用於預覽的 <polyline> 元素

function setMode(newMode, options = {}) {
    // 清理上一個模式的狀態
    if (ghostComponent) { ghostComponent.remove(); ghostComponent = null; }
    if (tempWireEl) { tempWireEl.remove(); tempWireEl = null; }

    state.mode = newMode;
    state.placingType = options.placingType || null;
    state.selectedComponentIds = [];
    state.ghostRotation = 0;
    state.currentWirePoints = [];
    state.wireDirection = 'UNDETERMINED'; // << 新增：重置佈線方向
    
    // 如果是放置模式，創建幽靈元件
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
    if (e.button === 1) { // 中鍵平移優先
        state.isPanning = true; state.panStart = { x: e.clientX, y: e.clientY };
        svg.style.cursor = 'grabbing';
        return;
    }
    if (e.button === 2) { // 右鍵
        if (state.mode === 'WIRING' && state.currentWirePoints.length > 0) {
            e.preventDefault();
            finalizeCurrentWire();
        }
        return;
    }
    // 只處理左鍵
    if (e.button !== 0) return;

    if (state.mode === 'PLACING') {
        const { x, y } = getSvgCoords(e);
        const snappedX = snapToGrid(x, gridSize);
        const snappedY = snapToGrid(y, gridSize);
        const newComp = createComponentData(state.placingType, snappedX, snappedY);
        newComp.rotation = state.ghostRotation; // 應用預覽時的旋轉
        updateComponentTerminals(newComp); // 根據旋轉更新端點
        circuit.components.push(newComp);
        render();

        // 重新創建幽靈元件，使其在放置後能繼續顯示
        if (state.mode === 'PLACING' && state.placingType) {
            if (ghostComponent) ghostComponent.remove();
            ghostComponent = document.createElementNS(svgNS, 'g');
            ghostComponent.innerHTML = getComponentSVG(state.placingType);
            ghostComponent.classList.add('ghost');
            svg.appendChild(ghostComponent);
            onMouseMove(e); // 手動觸發一次 onMouseMove 來立即定位新的幽靈元件
        }
    } else if (state.mode === 'WIRING') {
        const { snapPoint, connected } = getWireSnapPoint(e);

        if (state.currentWirePoints.length === 0) {
            // 開始一條新的導線
            state.currentWirePoints.push(snapPoint);
            tempWireEl = document.createElementNS(svgNS, 'polyline');
            tempWireEl.classList.add('wire');
            tempWireEl.style.opacity = '0.7';
            svg.appendChild(tempWireEl);
        } else {
            // 繼續現有的導線
            const lastPoint = state.currentWirePoints[state.currentWirePoints.length - 1];
            let intermediatePoint;

            // 根據滑鼠移動時鎖定的方向來決定轉角點
            // 如果沒有移動（方向未定），則預設為水平優先
            if (state.wireDirection === 'VERTICAL') {
                intermediatePoint = { x: lastPoint.x, y: snapPoint.y };
            } else { // 'HORIZONTAL' or 'UNDETERMINED'
                intermediatePoint = { x: snapPoint.x, y: lastPoint.y };
            }
            
            // 避免產生零長度的線段
            if (intermediatePoint.x !== lastPoint.x || intermediatePoint.y !== lastPoint.y) {
                 state.currentWirePoints.push(intermediatePoint);
            }
            state.currentWirePoints.push(snapPoint);
            
            if (connected) {
                finalizeCurrentWire();
            }
        }
        // 為下一段線路重置方向
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
        
        const DIR_LOCK_THRESHOLD = 10; // 超過10像素的移動就鎖定方向
        const DIR_RESET_RADIUS = gridSize * 1.5; // 在起點半徑範圍內可重置方向

        // 後悔機制：如果滑鼠移回起點附近，重置方向
        if (dist < DIR_RESET_RADIUS) {
            state.wireDirection = 'UNDETERMINED';
        } 
        // 方向鎖定：如果方向未定且移動超過閾值，則根據移動方向鎖定
        else if (state.wireDirection === 'UNDETERMINED' && dist > DIR_LOCK_THRESHOLD) {
            state.wireDirection = (dx > dy) ? 'HORIZONTAL' : 'VERTICAL';
        }
        
        let previewPoints = [...state.currentWirePoints];
        let intermediatePoint;

        if (state.wireDirection === 'HORIZONTAL') {
            intermediatePoint = { x: snapPoint.x, y: lastPoint.y };
            previewPoints.push(intermediatePoint, snapPoint);
        } else if (state.wireDirection === 'VERTICAL') {
            intermediatePoint = { x: lastPoint.x, y: snapPoint.y };
            previewPoints.push(intermediatePoint, snapPoint);
        } else { // 'UNDETERMINED'
            // 方向未定時，只畫一條直線到滑鼠位置
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
        snapPoint = { x: nearestTerminal.x, y: nearestTerminal.y, terminal: nearestTerminal };
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

    // 清理線路點：移除連續的重複點
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
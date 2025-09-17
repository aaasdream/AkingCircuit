import { svg, state, circuit, gridSize, svgNS } from './state.js';
import { updateViewBox, getSvgCoords, snapToGrid, findNearestTerminal, render } from './canvas.js';
import { createComponentData, getComponentSVG, updateComponentTerminals } from './components.js';
import { updateButtonStates, updatePropertiesPanel } from './ui.js';

let ghostComponent = null;
let tempWire = null;

function setMode(newMode, options = {}) {
    state.mode = newMode;
    state.placingType = options.placingType || null;
    state.selectedComponentIds = [];
    state.ghostRotation = 0; // 重置幽靈旋轉
    
    if (ghostComponent) { ghostComponent.remove(); ghostComponent = null; }
    if (tempWire) { tempWire.remove(); tempWire = null; }

    if (state.mode === 'PLACING') {
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
    // 中鍵平移優先
    if (e.button === 1) {
        state.isPanning = true; state.panStart = { x: e.clientX, y: e.clientY };
        svg.style.cursor = 'grabbing';
        return;
    }
    // 只處理左鍵
    if (e.button !== 0) return;

    const { x, y } = getSvgCoords(e);
    
    if (state.mode === 'PLACING') {
        const snappedX = snapToGrid(x, gridSize);
        const snappedY = snapToGrid(y, gridSize);
        const newComp = createComponentData(state.placingType, snappedX, snappedY);
        newComp.rotation = state.ghostRotation; // 應用預覽時的旋轉
        updateComponentTerminals(newComp); // 根據旋轉更新端點
        circuit.components.push(newComp);
        render();
    } else if (state.mode === 'WIRING') {
        const nearestTerminal = findNearestTerminal(x, y, 10);
        if (!nearestTerminal) return;

        const startComp = circuit.components.find(c => c.id === nearestTerminal.componentId);
        const startPos = startComp.terminals[nearestTerminal.terminalId];

        if (!state.wireStartTerminal) {
            state.wireStartTerminal = nearestTerminal;
            tempWire = document.createElementNS(svgNS, 'line');
            tempWire.setAttribute('x1', startPos.x); tempWire.setAttribute('y1', startPos.y);
            tempWire.setAttribute('x2', x); tempWire.setAttribute('y2', y);
            tempWire.classList.add('wire'); tempWire.style.pointerEvents = 'none';
            svg.appendChild(tempWire);
        } else {
            const endTerminal = nearestTerminal;
            const startTerminal = state.wireStartTerminal;
            if (startTerminal.componentId !== endTerminal.componentId || startTerminal.terminalId !== endTerminal.terminalId) {
                circuit.wires.push({ from: startTerminal, to: endTerminal });
            }
            state.wireStartTerminal = null;
            if (tempWire) tempWire.remove();
            tempWire = null;
            render();
        }
    } else if (state.mode === 'SELECT') {
        const clickedElement = e.target.closest('.component');
        const clickedId = clickedElement ? clickedElement.dataset.id : null;
        
        // 檢查是否點擊在已選取的元件上，以啟動拖曳
        if (clickedId && state.selectedComponentIds.includes(clickedId)) {
            state.isDragging = true;
            state.dragStart = { x, y };
            state.componentDragStartPositions.clear();
            state.selectedComponentIds.forEach(id => {
                const comp = circuit.components.find(c => c.id === id);
                if (comp) {
                    state.componentDragStartPositions.set(id, { x: comp.x, y: comp.y });
                }
            });
            return; // 進入拖曳模式，不執行下面的選取邏輯
        }

        // 正常的選取邏輯
        if (e.shiftKey) {
            if (clickedId) {
                const index = state.selectedComponentIds.indexOf(clickedId);
                if (index > -1) {
                    state.selectedComponentIds.splice(index, 1);
                } else {
                    state.selectedComponentIds.push(clickedId);
                }
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

    // 處理元件拖曳
    if (state.isDragging) {
        const dx = x - state.dragStart.x;
        const dy = y - state.dragStart.y;

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
    } else if (state.mode === 'WIRING' && tempWire) {
        tempWire.setAttribute('x2', x);
        tempWire.setAttribute('y2', y);
    }
}

function onMouseUp(e) {
    if (e.button === 1) { // 中鍵
        state.isPanning = false;
        const cursors = { 'SELECT': 'default', 'WIRING': 'crosshair', 'PLACING': 'crosshair' };
        svg.style.cursor = cursors[state.mode] || 'default';
    }

    // 結束元件拖曳
    if (state.isDragging) {
        state.isDragging = false;
        // 將元件的最終位置對齊網格
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

// 新增：處理右鍵點擊事件
function onContextMenu(e) {
    e.preventDefault(); // 阻止瀏覽器預設的右鍵選單
    if (state.mode === 'PLACING') {
        state.ghostRotation = (state.ghostRotation + 90) % 360;
        // 手動觸發一次 mousemove 來更新 ghostComponent 的位置和旋轉
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
        if (state.mode === 'WIRING' && state.wireStartTerminal) {
            state.wireStartTerminal = null;
            if(tempWire) tempWire.remove();
            tempWire = null;
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
    svg.addEventListener('contextmenu', onContextMenu); // 新增右鍵監聽
    svg.addEventListener('mouseleave', () => { // 增加 mouseleave 處理
        if (state.isPanning) state.isPanning = false;
        if (state.isDragging) onMouseUp({button: 0}); // 如果拖曳時滑鼠移出畫布，等同於放開
    });
    window.addEventListener('keydown', onKeyDown);
}
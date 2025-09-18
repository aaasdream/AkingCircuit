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
            // 手動觸發一次 onMouseMove 來立即定位新的幽靈元件
            onMouseMove(e);
        }
    } else if (state.mode === 'WIRING') {
        const { snapPoint, connected } = getWireSnapPoint(e);

        if (snapPoint.wire) {
            // 在現有導線上創建一個新的連接點
            const originalWire = circuit.wires.find(w => w.id === snapPoint.wire.wireId);
            if (originalWire) {
                // 確保點擊的精確位置被使用
                const newPoint = { x: snapPoint.x, y: snapPoint.y }; 
                const segmentStartIndex = originalWire.points.indexOf(snapPoint.wire.segment[0]);
                
                if (segmentStartIndex !== -1) {
                    // 檢查該點是否已存在於線段的端點
                    const pointExists = originalWire.points.some(p => p.x === newPoint.x && p.y === newPoint.y);
                    if (!pointExists) {
                        // 插入新點到正確的線段位置
                        originalWire.points.splice(segmentStartIndex + 1, 0, newPoint);
                    }
                }
            }
        }

        if (state.currentWirePoints.length === 0) {
            state.currentWirePoints.push(snapPoint);
            tempWireEl = document.createElementNS(svgNS, 'polyline');
            tempWireEl.classList.add('wire');
            tempWireEl.style.opacity = '0.7';
            svg.appendChild(tempWireEl);
        } else {
            const lastPoint = state.currentWirePoints[state.currentWirePoints.length - 1];
            const intermediatePoint = getOrthogonalIntermediatePoint(lastPoint, snapPoint);
            state.currentWirePoints.push(intermediatePoint, snapPoint);
            if (connected) {
                finalizeCurrentWire();
            }
        }
    } else if (state.mode === 'SELECT') {
        const { x, y } = getSvgCoords(e);
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
        const { x, y } = getSvgCoords(e);
        const snappedX = snapToGrid(x, gridSize);
        const snappedY = snapToGrid(y, gridSize);
        ghostComponent.setAttribute('transform', `translate(${snappedX}, ${snappedY}) rotate(${state.ghostRotation})`);
    } else if (state.mode === 'WIRING' && tempWireEl && state.currentWirePoints.length > 0) {
        const lastPoint = state.currentWirePoints[state.currentWirePoints.length - 1];
        const { snapPoint } = getWireSnapPoint(e);
        const intermediatePoint = getOrthogonalIntermediatePoint(lastPoint, snapPoint);
        const previewPoints = [...state.currentWirePoints, intermediatePoint, snapPoint];
        tempWireEl.setAttribute('points', previewPoints.map(p => `${p.x},${p.y}`).join(' '));
    }
}

/**
 * 獲取導線繪製時的吸附點
 * @param {MouseEvent} e - 滑鼠事件
 * @returns {{snapPoint: object, connected: boolean}}
 */
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

function isRectColliding(rect) {
    for (const comp of circuit.components) {
        // 簡化碰撞檢測，將元件視為一個以中心點為準、有一定大小的方塊
        // 這裡的 30x30 是一個估計值，未來可以根據元件的實際大小進行調整
        const compRect = {
            x: comp.x - 15,
            y: comp.y - 15,
            width: 30,
            height: 30
        };

        // 檢查兩個矩形是否重疊
        if (rect.x < compRect.x + compRect.width &&
            rect.x + rect.width > compRect.x &&
            rect.y < compRect.y + compRect.height &&
            rect.y + rect.height > compRect.y) {
            return true; // 發生碰撞
        }
    }
    return false; // 沒有碰撞
}

function getOrthogonalIntermediatePoint(p1, p2) {
    // 兩個可能的拐點
    const path1_intermediate = { x: p2.x, y: p1.y };
    const path2_intermediate = { x: p1.x, y: p2.y };

    // 檢查路徑1的碰撞
    const path1_rect1 = { x: Math.min(p1.x, path1_intermediate.x), y: Math.min(p1.y, path1_intermediate.y), width: Math.abs(p1.x - path1_intermediate.x), height: Math.abs(p1.y - path1_intermediate.y) };
    const path1_rect2 = { x: Math.min(path1_intermediate.x, p2.x), y: Math.min(path1_intermediate.y, p2.y), width: Math.abs(path1_intermediate.x - p2.x), height: Math.abs(path1_intermediate.y - p2.y) };
    const path1_collides = isRectColliding(path1_rect1) || isRectColliding(path1_rect2);

    // 檢查路徑2的碰撞
    const path2_rect1 = { x: Math.min(p1.x, path2_intermediate.x), y: Math.min(p1.y, path2_intermediate.y), width: Math.abs(p1.x - path2_intermediate.x), height: Math.abs(p1.y - path2_intermediate.y) };
    const path2_rect2 = { x: Math.min(path2_intermediate.x, p2.x), y: Math.min(path2_intermediate.y, p2.y), width: Math.abs(path2_intermediate.x - p2.x), height: Math.abs(path2_intermediate.y - p2.y) };
    const path2_collides = isRectColliding(path2_rect1) || isRectColliding(path2_rect2);

    // 預設路徑選擇
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);
    const defaultChoice = (dx > dy) ? path1_intermediate : path2_intermediate;
    const alternativeChoice = (dx > dy) ? path2_intermediate : path1_intermediate;

    if (defaultChoice === path1_intermediate) {
        if (!path1_collides) return path1_intermediate;
        if (!path2_collides) return path2_intermediate;
    } else { // defaultChoice is path2
        if (!path2_collides) return path2_intermediate;
        if (!path1_collides) return path1_intermediate;
    }
    
    // 如果兩條路徑都碰撞或都暢通，則返回預設選擇
    return defaultChoice;
}

function finalizeCurrentWire() {
    if (state.currentWirePoints.length < 2) {
        state.currentWirePoints = [];
        if (tempWireEl) { tempWireEl.remove(); tempWireEl = null; }
        return;
    }
    const newWire = {
        id: `w${circuit.wires.length + 1}`,
        points: state.currentWirePoints,
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
    svg.addEventListener('contextmenu', onContextMenu); // 新增右鍵監聽
    svg.addEventListener('mouseleave', () => { // 增加 mouseleave 處理
        if (state.isPanning) state.isPanning = false;
        if (state.isDragging) onMouseUp({button: 0}); // 如果拖曳時滑鼠移出畫布，等同於放開
    });
    window.addEventListener('keydown', onKeyDown);
}
import { svg, svgNS, state, circuit, gridSize } from './state.js';
import { getComponentSVG } from './components.js';

/**
 * 在 SVG 中創建一個可重複的網格圖案背景。
 * @param {number} gridSize - 網格點之間的距離。
 */
export function createGridPattern(gridSize) {
    const defs = document.createElementNS(svgNS, 'defs');
    const pattern = document.createElementNS(svgNS, 'pattern');
    pattern.setAttribute('id', 'grid');
    pattern.setAttribute('width', gridSize);
    pattern.setAttribute('height', gridSize);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '1');
    circle.setAttribute('cy', '1');
    circle.setAttribute('r', '1');
    circle.setAttribute('fill', '#555');
    pattern.appendChild(circle);
    defs.appendChild(pattern);
    svg.appendChild(defs);
    const gridRect = document.createElementNS(svgNS, 'rect');
    gridRect.setAttribute('width', '100%');
    gridRect.setAttribute('height', '100%');
    gridRect.setAttribute('fill', 'url(#grid)');
    svg.insertBefore(gridRect, svg.firstChild);
}

/**
 * 根據當前的 state.viewBox 狀態更新 SVG 的視窗。
 */
export function updateViewBox() {
    svg.setAttribute('viewBox', `${state.viewBox.x} ${state.viewBox.y} ${state.viewBox.w} ${state.viewBox.h}`);
}

/**
 * 主渲染函數，負責重繪整個電路 SVG - 新物件模型版本
 */
export function render() {
    // 清除舊的渲染內容（保留網格背景）
    const elementsToRemove = svg.querySelectorAll('.component, .wire, .terminal-dot');
    elementsToRemove.forEach(el => el.remove());

    // 渲染所有元件
    for (const component of circuit.components.values()) {
        renderComponent(component);
    }

    // 渲染所有電線
    for (const wire of circuit.wires.values()) {
        renderWire(wire);
    }

    // 渲染接腳/端點（用於除錯和視覺化）
    if (state.showTerminals) {
        for (const component of circuit.components.values()) {
            component.pins.forEach(pin => {
                renderPin(pin);
            });
        }
    }
}

/**
 * 渲染單個元件
 */
function renderComponent(component) {
    const group = document.createElementNS(svgNS, 'g');
    group.classList.add('component');
    group.dataset.id = component.id;
    
    // 設置變換
    group.setAttribute('transform', 
        `translate(${component.x}, ${component.y}) rotate(${component.rotation})`
    );
    
    // 添加 SVG 內容
    group.innerHTML = getComponentSVG(component.type);
    
    // 標記選中狀態
    if (state.selectedComponentIds.includes(component.id)) {
        group.classList.add('selected');
    }
    
    svg.appendChild(group);
}

/**
 * 渲染單條電線
 */
function renderWire(wire) {
    if (wire.vertices.length < 2) return;
    
    const polyline = document.createElementNS(svgNS, 'polyline');
    polyline.classList.add('wire');
    polyline.dataset.id = wire.id;
    
    // 設置路徑點
    const pointsStr = wire.vertices.map(v => `${v.x},${v.y}`).join(' ');
    polyline.setAttribute('points', pointsStr);
    
    svg.appendChild(polyline);
}

/**
 * 渲染接腳（用於除錯）
 */
function renderPin(pin) {
    const pos = pin.getAbsolutePosition();
    const circle = document.createElementNS(svgNS, 'circle');
    circle.classList.add('terminal-dot');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', '3');
    circle.setAttribute('fill', pin.connectedWire ? 'red' : 'blue');
    svg.appendChild(circle);
}

/**
 * 將滑鼠事件的座標轉換為 SVG 座標系統。
 * @param {Event} event - 滑鼠事件。
 * @returns {object} - 包含 x, y 屬性的座標物件。
 */
export function getSvgCoords(event) {
    const rect = svg.getBoundingClientRect();
    const scaleX = state.viewBox.w / rect.width;
    const scaleY = state.viewBox.h / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX + state.viewBox.x,
        y: (event.clientY - rect.top) * scaleY + state.viewBox.y
    };
}

/**
 * 將給定的座標對齊到最近的網格點。
 * @param {number} coord - 要對齊的座標。
 * @param {number} gridSize - 網格大小。
 * @returns {number} - 對齊後的座標。
 */
export function snapToGrid(coord, gridSize) {
    return Math.round(coord / gridSize) * gridSize;
}

/**
 * 檢查一個由多個點定義的路徑是否與元件發生碰撞。
 * @param {Array<object>} points - 構成路徑的點陣列。
 * @param {Array<string>} [ignoreComponentIds=[]] - 應忽略的元件ID列表。
 * @returns {boolean} - 如果路徑發生碰撞則返回 true。
 */
export function isPathColliding(points, ignoreComponentIds = []) {
    if (points.length < 2) return false;

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const padding = 5;
        const rect = {
            x: Math.min(p1.x, p2.x) - padding,
            y: Math.min(p1.y, p2.y) - padding,
            width: Math.abs(p1.x - p2.x) + padding * 2,
            height: Math.abs(p1.y - p2.y) + padding * 2
        };

        if (isRectCollidingWithComponents(rect, ignoreComponentIds)) {
            return true;
        }
    }
    return false;
}

/**
 * 檢查一個矩形區域是否與電路中的任何元件重疊。
 * @param {object} rect - 要檢查的矩形區域 {x, y, width, height}。
 * @param {Array<string>} [ignoreComponentIds=[]] - 應在檢查中忽略的元件ID列表。
 * @returns {boolean} - 如果發生碰撞則返回 true。
 */
function isRectCollidingWithComponents(rect, ignoreComponentIds = []) {
    for (const comp of circuit.components.values()) {
        if (ignoreComponentIds.includes(comp.id)) {
            continue;
        }

        const compRect = {
            x: comp.x - gridSize * 2,
            y: comp.y - gridSize * 1.5,
            width: gridSize * 4,
            height: gridSize * 3
        };

        if (rect.x < compRect.x + compRect.width &&
            rect.x + rect.width > compRect.x &&
            rect.y < compRect.y + compRect.height &&
            rect.y + rect.height > compRect.y) {
            return true;
        }
    }
    return false;
}

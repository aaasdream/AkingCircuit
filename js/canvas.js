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
 * 將點的陣列轉換為 SVG polyline 所需的 "points" 字串格式。
 * @param {Array<object>} points - 包含 {x, y} 物件的陣列。
 * @returns {string} - 格式化後的點字串。
 */
function pointsToSvgPath(points) {
    return points.map(p => `${p.x},${p.y}`).join(' ');
}

/**
 * 更新導線的端點，使其「吸附」到所連接的元件端點上。
 * @param {object} wire - 要處理的導線物件。
 */
function snapWireEndpoints(wire) {
    const snapPoint = (point) => {
        if (point && point.terminal) {
            const component = circuit.components.find(c => c.id === point.terminal.componentId);
            if (component) {
                const terminalPos = component.terminals[point.terminal.terminalId];
                point.x = terminalPos.x;
                point.y = terminalPos.y;
            }
        }
    };
    snapPoint(wire.points[0]);
    snapPoint(wire.points[wire.points.length - 1]);
}

/**
 * 簡化導線，移除共線的多餘點。
 * @param {object} wire - 要簡化的導線物件。
 * @param {Set<string>} [junctionPoints=new Set()] - 一個包含 'x,y' 格式的節點鍵集合，這些節點不應被簡化。
 */
function simplifyWire(wire, junctionPoints = new Set()) {
    if (wire.points.length < 3) return;

    const simplifiedPoints = [wire.points[0]];
    for (let i = 1; i < wire.points.length - 1; i++) {
        const p_prev = simplifiedPoints[simplifiedPoints.length - 1];
        const p_curr = wire.points[i];
        const p_next = wire.points[i + 1];
        const pointKey = `${p_curr.x},${p_curr.y}`;

        if (p_curr.isNode || junctionPoints.has(pointKey) || p_curr.terminal) {
            simplifiedPoints.push(p_curr);
            continue;
        }
        const isCollinear = (p_prev.x === p_curr.x && p_curr.x === p_next.x) ||
                            (p_prev.y === p_curr.y && p_curr.y === p_next.y);
        if (!isCollinear) {
            simplifiedPoints.push(p_curr);
        }
    }
    simplifiedPoints.push(wire.points[wire.points.length - 1]);
    wire.points = simplifiedPoints;
}

/**
 * 檢查一個矩形區域是否與電路中的任何元件重疊。
 * @param {object} rect - 要檢查的矩形區域 {x, y, width, height}。
 * @param {Array<string>} [ignoreComponentIds=[]] - 應在檢查中忽略的元件ID列表。
 * @returns {boolean} - 如果發生碰撞則返回 true。
 */
function isRectCollidingWithComponents(rect, ignoreComponentIds = []) {
    for (const comp of circuit.components) {
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
 * 主渲染函數，負責重繪整個電路 SVG。
 */
export function render() {
    // --- 預渲染階段 ---
    circuit.wires.forEach(snapWireEndpoints);

    const pointConnections = new Map();
    circuit.components.forEach(comp => {
        Object.values(comp.terminals).forEach(term => {
            const key = `${term.x},${term.y}`;
            if (!pointConnections.has(key)) {
                pointConnections.set(key, { isTerminal: true, wireIds: new Set() });
            } else {
                pointConnections.get(key).isTerminal = true;
            }
        });
    });
    circuit.wires.forEach(wire => {
        wire.points.forEach(p => {
            const key = `${p.x},${p.y}`;
            if (!pointConnections.has(key)) {
                pointConnections.set(key, { isTerminal: false, wireIds: new Set() });
            }
            pointConnections.get(key).wireIds.add(wire.id);
        });
    });
    
    const junctionPoints = new Set();
    pointConnections.forEach((conn, key) => {
        const isJunction = conn.isTerminal || conn.wireIds.size > 1;
        if (isJunction) {
            junctionPoints.add(key);
        }
    });

    circuit.wires.forEach(wire => simplifyWire(wire, junctionPoints));

    // --- 渲染階段 ---
    while (svg.children.length > 2) {
        svg.removeChild(svg.children[2]);
    }

    circuit.wires.forEach(wire => {
        const polyline = document.createElementNS(svgNS, 'polyline');
        polyline.setAttribute('points', pointsToSvgPath(wire.points));
        polyline.classList.add('wire');
        if (state.selectedWireIds.includes(wire.id)) {
            polyline.style.stroke = '#00FFFF';
        }
        polyline.dataset.id = wire.id;
        svg.appendChild(polyline);
    });
    
    const renderedNodes = new Set(); 
    circuit.wires.forEach(wire => {
        wire.points.forEach(p => {
            const pointKey = `${p.x},${p.y}`;
            if (p.isNode && !renderedNodes.has(pointKey)) {
                const handleSize = 14; 
                const rect = document.createElementNS(svgNS, 'rect');
                rect.setAttribute('x', p.x - handleSize / 2);
                rect.setAttribute('y', p.y - handleSize / 2);
                rect.setAttribute('width', handleSize);
                rect.setAttribute('height', handleSize);
                rect.classList.add('wire-vertex-handle');
                if (state.selectedNodeKeys.includes(pointKey)) {
                    rect.classList.add('selected');
                }
                svg.appendChild(rect);
                renderedNodes.add(pointKey);
            }
        });
    });

    circuit.components.forEach(comp => {
        const g = document.createElementNS(svgNS, 'g');
        g.innerHTML = getComponentSVG(comp.type);
        g.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${comp.rotation})`);
        g.classList.add('component');
        g.dataset.id = comp.id;
        if (state.selectedComponentIds.includes(comp.id)) {
            g.classList.add('selected');
        }
        svg.appendChild(g);
    });

    circuit.components.forEach(comp => {
        Object.values(comp.terminals).forEach(term => {
            const terminalDot = document.createElementNS(svgNS, 'circle');
            terminalDot.setAttribute('cx', term.x);
            terminalDot.setAttribute('cy', term.y);
            terminalDot.setAttribute('r', 4);
            terminalDot.classList.add('component-terminal');
            svg.appendChild(terminalDot);
        });
    });

    pointConnections.forEach((conn, key) => {
        const isConnectionPoint = conn.wireIds.size > 1 || (conn.isTerminal && conn.wireIds.size > 0);
        if (isConnectionPoint) {
            const [xStr, yStr] = key.split(',');
            const dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', parseFloat(xStr));
            dot.setAttribute('cy', parseFloat(yStr));
            dot.setAttribute('r', 4);
            dot.classList.add('junction-dot');
            svg.appendChild(dot);
        }
    });
}

// --- 輔助函式 ---

export function getSvgCoords(e) {
    let pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

export function snapToGrid(value, gridSize) {
    return Math.round(value / gridSize) * gridSize;
}

export function findNearestTerminal(x, y, radius) {
    let nearest = null;
    let minDistSq = radius * radius;
    for (const comp of circuit.components) {
        for (const termId in comp.terminals) {
            const term = comp.terminals[termId];
            const dx = x - term.x, dy = y - term.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearest = { type: 'terminal', componentId: comp.id, terminalId: termId, x: term.x, y: term.y };
            }
        }
    }
    return nearest;
}

export function findNearestWire(x, y, radius) {
    let nearest = null;
    let minDist = radius;
    for (const wire of circuit.wires) {
        for (let i = 0; i < wire.points.length - 1; i++) {
            const p1 = wire.points[i];
            const p2 = wire.points[i + 1];
            if (Math.max(p1.x, p2.x) < x - radius || Math.min(p1.x, p2.x) > x + radius ||
                Math.max(p1.y, p2.y) < y - radius || Math.min(p1.y, p2.y) > y + radius) {
                continue;
            }
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq === 0) continue;
            let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = p1.x + t * dx;
            const projY = p1.y + t * dy;
            const dist = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
            if (dist < minDist) {
                minDist = dist;
                nearest = {
                    type: 'wire',
                    wireId: wire.id,
                    x: snapToGrid(projX, gridSize),
                    y: snapToGrid(projY, gridSize),
                    segment: [p1, p2]
                };
            }
        }
    }
    return nearest;
}

/**
 * 【已修改】尋找滑鼠附近最近的導線節點（轉折點）。
 * @param {number} x - 滑鼠的 X 座標。
 * @param {number} y - 滑鼠的 Y 座標。
 * @param {number} radius - 搜尋半徑。
 * @returns {object|null} - 如果找到節點，返回包含節點物件【參考】的資訊，否則返回 null。
 */
export function findNearestNode(x, y, radius) {
    let nearest = null;
    let minDistSq = radius * radius;

    for (const wire of circuit.wires) {
        for (const point of wire.points) {
            if (point.isNode) {
                const dx = x - point.x;
                const dy = y - point.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearest = { type: 'node', point: point }; // 返回 point 物件本身的參考
                }
            }
        }
    }
    return nearest;
}
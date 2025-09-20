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
 * 【新增的輔助函式】
 * 更新導線的端點，使其「吸附」到所連接的元件端點上。
 * @param {object} wire - 要處理的導線物件。
 */
function snapWireEndpoints(wire) {
    const snapPoint = (point) => {
        if (point && point.terminal) {
            const component = circuit.components.find(c => c.id === point.terminal.componentId);
            if (component) {
                const terminalPos = component.terminals[point.terminal.terminalId];
                // 直接更新點物件的座標
                point.x = terminalPos.x;
                point.y = terminalPos.y;
            }
        }
    };

    // 處理導線的起始點
    snapPoint(wire.points[0]);
    // 處理導線的結束點
    snapPoint(wire.points[wire.points.length - 1]);
}


/**
 * 簡化導線，移除共線的多餘點。
 * @param {object} wire - 要簡化的導線物件。
 */
function simplifyWire(wire) {
    if (wire.points.length < 3) return;

    const simplifiedPoints = [wire.points[0]];
    for (let i = 1; i < wire.points.length - 1; i++) {
        const p_prev = simplifiedPoints[simplifiedPoints.length - 1];
        const p_curr = wire.points[i];
        const p_next = wire.points[i + 1];

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
    // --- 預渲染階段：在繪製前更新導線的幾何結構 ---

    // 【修改處】步驟 1: 端點吸附 - 確保所有導線的端點都與其所連接的元件保持同步
    circuit.wires.forEach(snapWireEndpoints);


    // 步驟 1.5: 創建「穿透式」連接
    if (!state.isDragging) {
        const allTerminals = [];
        circuit.components.forEach(comp => {
            Object.keys(comp.terminals).forEach(termId => {
                allTerminals.push({
                    ...comp.terminals[termId],
                    componentId: comp.id,
                    terminalId: termId
                });
            });
        });

        circuit.wires.forEach(wire => {
            const insertions = [];
            for (let i = 0; i < wire.points.length - 1; i++) {
                const p1 = wire.points[i];
                const p2 = wire.points[i + 1];

                allTerminals.forEach(term => {
                    const termIsOnSegment = 
                        (Math.abs(p1.x - term.x) + Math.abs(p2.x - term.x) === Math.abs(p1.x - p2.x)) &&
                        (Math.abs(p1.y - term.y) + Math.abs(p2.y - term.y) === Math.abs(p1.y - p2.y));

                    if (termIsOnSegment) {
                        const pointExists = wire.points.some(p => p.x === term.x && p.y === term.y);
                        if (!pointExists) {
                            insertions.push({
                                index: i + 1,
                                point: {
                                    x: term.x,
                                    y: term.y,
                                    terminal: { componentId: term.componentId, terminalId: term.terminalId }
                                }
                            });
                        }
                    }
                });
            }
            
            if (insertions.length > 0) {
                insertions.sort((a, b) => b.index - a.index).forEach(ins => {
                    wire.points.splice(ins.index, 0, ins.point);
                });
            }
        });
    }

    // 步驟 2: 正交性修復 - 處理因元件移動導致的線路變形
    circuit.wires.forEach(wire => {
        const ignoreIds = new Set();
        const startTerminal = wire.points[0].terminal;
        const endTerminal = wire.points[wire.points.length - 1].terminal;
        if (startTerminal) ignoreIds.add(startTerminal.componentId);
        if (endTerminal) ignoreIds.add(endTerminal.componentId);
        const ignoreIdsArray = Array.from(ignoreIds);

        if (wire.points.length === 2) {
            const p1 = wire.points[0];
            const p2 = wire.points[1];
            if (p1.x !== p2.x && p1.y !== p2.y) {
                const pathH_intermediate = { x: p2.x, y: p1.y };
                const pathV_intermediate = { x: p1.x, y: p2.y };
                const pathH_collides = isPathColliding([p1, pathH_intermediate, p2], ignoreIdsArray);
                const pathV_collides = isPathColliding([p1, pathV_intermediate, p2], ignoreIdsArray);

                let chosenIntermediate;
                if (pathH_collides && !pathV_collides) {
                    chosenIntermediate = pathV_intermediate;
                } else if (!pathH_collides && pathV_collides) {
                    chosenIntermediate = pathH_intermediate;
                } else {
                    const dx = Math.abs(p1.x - p2.x);
                    const dy = Math.abs(p1.y - p2.y);
                    chosenIntermediate = (dx > dy) ? pathH_intermediate : pathV_intermediate;
                }
                wire.points.splice(1, 0, chosenIntermediate);
            }
        } else if (wire.points.length > 2) {
            const p1 = wire.points[0];
            const p2 = wire.points[1];
            const p3 = wire.points[2];
            if (p2.y === p3.y) { p2.x = p1.x; } else if (p2.x === p3.x) { p2.y = p1.y; }

            const pn = wire.points[wire.points.length - 1];
            const pn_1 = wire.points[wire.points.length - 2];
            const pn_2 = wire.points[wire.points.length - 3];
            if (pn_2.y === pn_1.y) { pn_1.x = pn.x; } else if (pn_2.x === pn_1.x) { pn_1.y = pn.y; }
        }
    });

    // 步驟 3: 線路簡化 - 移除共線的多餘節點
    circuit.wires.forEach(simplifyWire);

    // --- 渲染階段 ---

    // 清除畫布 (保留網格和 defs)
    while (svg.children.length > 2) {
        svg.removeChild(svg.children[2]);
    }

    // 渲染導線
    circuit.wires.forEach(wire => {
        const polyline = document.createElementNS(svgNS, 'polyline');
        polyline.setAttribute('points', pointsToSvgPath(wire.points));
        polyline.classList.add('wire');
        if (state.selectedWireIds.includes(wire.id)) {
            polyline.style.stroke = '#00FFFF'; // 高亮選中的導線 (青色)
        }
        polyline.dataset.id = wire.id;
        svg.appendChild(polyline);
    });
    
    // 【新增】渲染選中導線的控制點
    state.selectedWireIds.forEach(wireId => {
        const wire = circuit.wires.find(w => w.id === wireId);
        if (!wire) return;
        
        wire.points.forEach((p, index) => {
            // 我們只為中間的轉折點增加控制方塊
            if (index > 0 && index < wire.points.length - 1) {
                const handleSize = 8;
                const rect = document.createElementNS(svgNS, 'rect');
                rect.setAttribute('x', p.x - handleSize / 2);
                rect.setAttribute('y', p.y - handleSize / 2);
                rect.setAttribute('width', handleSize);
                rect.setAttribute('height', handleSize);
                rect.classList.add('wire-vertex-handle');
                rect.dataset.wireId = wireId;
                rect.dataset.pointIndex = index;
                svg.appendChild(rect);
            }
        });
    });


    // 渲染元件
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

    // 渲染「連接點」 (Connection Dots)
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

/**
 * 將客戶端座標 (clientX, clientY) 轉換為 SVG 內部座標。
 */
export function getSvgCoords(e) {
    let pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

/**
 * 將一個數值對齊到最近的網格點。
 */
export function snapToGrid(value, gridSize) {
    return Math.round(value / gridSize) * gridSize;
}

/**
 * 在指定半徑內查找離給定座標最近的元件端點。
 */
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

/**
 * 在指定半徑內查找離給定座標最近的導線段。
 */
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
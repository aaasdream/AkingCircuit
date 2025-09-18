import { svg, svgNS, state, circuit, gridSize } from './state.js';
import { getComponentSVG } from './components.js';

// 初始化網格背景
export function createGridPattern(gridSize) {
    const defs = document.createElementNS(svgNS, 'defs');
    const pattern = document.createElementNS(svgNS, 'pattern');
    pattern.setAttribute('id', 'grid'); pattern.setAttribute('width', gridSize);
    pattern.setAttribute('height', gridSize); pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '1'); circle.setAttribute('cy', '1'); circle.setAttribute('r', '1'); circle.setAttribute('fill', '#555');
    pattern.appendChild(circle); defs.appendChild(pattern); svg.appendChild(defs);
    const gridRect = document.createElementNS(svgNS, 'rect');
    gridRect.setAttribute('width', '100%'); gridRect.setAttribute('height', '100%');
    gridRect.setAttribute('fill', 'url(#grid)');
    svg.insertBefore(gridRect, svg.firstChild);
}

// 更新SVG的視窗
export function updateViewBox() {
    svg.setAttribute('viewBox', `${state.viewBox.x} ${state.viewBox.y} ${state.viewBox.w} ${state.viewBox.h}`);
}

function pointsToSvgPath(points) {
    return points.map(p => `${p.x},${p.y}`).join(' ');
}

function getOrthogonalIntermediatePoint(p1, p2) {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    return { x: midX, y: midY };
}

// **新增**：用於簡化線路的輔助函式
function simplifyWire(wire) {
    if (wire.points.length < 3) return; // 少於3個點不可能有冗餘

    const simplifiedPoints = [wire.points[0]];
    for (let i = 1; i < wire.points.length - 1; i++) {
        const p_prev = simplifiedPoints[simplifiedPoints.length - 1];
        const p_curr = wire.points[i];
        const p_next = wire.points[i + 1];

        // 檢查 p_prev, p_curr, p_next 是否共線
        const isCollinear = (p_prev.x === p_curr.x && p_curr.x === p_next.x) ||
                            (p_prev.y === p_curr.y && p_curr.y === p_next.y);

        if (!isCollinear) {
            simplifiedPoints.push(p_curr);
        }
    }
    simplifiedPoints.push(wire.points[wire.points.length - 1]);
    wire.points = simplifiedPoints;
}

export function render() {
    // --- Pre-rendering Phase: Update wire geometries before drawing ---

    // 步驟 1: 端點吸附 (Sticky Terminals) - 更新連接到元件的導線端點
    circuit.wires.forEach(wire => {
        // 檢查起始點
        const startPoint = wire.points[0];
        if (startPoint.terminal) {
            const component = circuit.components.find(c => c.id === startPoint.terminal.componentId);
            if (component) {
                const terminalPos = component.terminals[startPoint.terminal.terminalId];
                startPoint.x = terminalPos.x;
                startPoint.y = terminalPos.y;
            }
        }
        // 檢查結束點
        const endPoint = wire.points[wire.points.length - 1];
        if (endPoint.terminal) {
            const component = circuit.components.find(c => c.id === endPoint.terminal.componentId);
            if (component) {
                const terminalPos = component.terminals[endPoint.terminal.terminalId];
                endPoint.x = terminalPos.x;
                endPoint.y = terminalPos.y;
            }
        }
    });

    // 步驟 2: 正交性修復 (Orthogonality Fix) - 處理因元件移動導致的線路變形
    circuit.wires.forEach(wire => {
        // 處理只有兩個點的簡單導線
        if (wire.points.length === 2) {
            const p1 = wire.points[0];
            const p2 = wire.points[1];
            // 如果它變成了斜線，則插入一個中間點來形成直角
            if (p1.x !== p2.x && p1.y !== p2.y) {
                 const dx = Math.abs(p1.x - p2.x);
                 const dy = Math.abs(p1.y - p2.y);
                 let intermediatePoint;
                 // 預設選擇較短的路徑作為直線部分
                 if (dx > dy) {
                    intermediatePoint = { x: p2.x, y: p1.y };
                 } else {
                    intermediatePoint = { x: p1.x, y: p2.y };
                 }
                 wire.points.splice(1, 0, intermediatePoint);
            }
        } 
        // 處理超過兩個點的複雜導線
        else if (wire.points.length > 2) {
            // 從頭部開始修正
            const p1 = wire.points[0];
            const p2 = wire.points[1];
            const p3 = wire.points[2];
            // 檢查 p2-p3 線段是水平還是垂直
            if (p2.y === p3.y) { // 水平線段
                p2.x = p1.x; // 那麼 p1-p2 必須是垂直的
            } else if (p2.x === p3.x) { // 垂直線段
                p2.y = p1.y; // 那麼 p1-p2 必須是水平的
            }

            // 從尾部開始修正
            const pn = wire.points[wire.points.length - 1];
            const pn_1 = wire.points[wire.points.length - 2];
            const pn_2 = wire.points[wire.points.length - 3];
            // 檢查 pn_2 - pn_1 線段是水平還是垂直
            if (pn_2.y === pn_1.y) { // 水平線段
                pn_1.x = pn.x; // 那麼 pn_1 - pn 必須是垂直的
            } else if (pn_2.x === pn_1.x) { // 垂直線段
                pn_1.y = pn.y; // 那麼 pn_1 - pn 必須是水平的
            }
        }
    });

    // 步驟 3: 線路簡化 (Wire Simplification) - 移除共線的多餘節點
    circuit.wires.forEach(simplifyWire);

    // --- Rendering Phase ---

    // Clear canvas (preserving grid and defs)
    while (svg.children.length > 2) {
        svg.removeChild(svg.children[2]);
    }

    // Render wires
    circuit.wires.forEach(wire => {
        const polyline = document.createElementNS(svgNS, 'polyline');
        polyline.setAttribute('points', pointsToSvgPath(wire.points));
        polyline.classList.add('wire');
        polyline.dataset.id = wire.id;
        svg.appendChild(polyline);
    });

    // Render components and their terminals
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
        Object.values(comp.terminals).forEach(term => {
            const terminalCircle = document.createElementNS(svgNS, 'circle');
            terminalCircle.setAttribute('cx', term.x); terminalCircle.setAttribute('cy', term.y);
            terminalCircle.setAttribute('r', 5);
            terminalCircle.classList.add('component-terminal');
            svg.appendChild(terminalCircle);
        });
    });

    // Render Junction Dots
    const pointConnections = new Map();

    // Collect all points from terminals and wires
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

    // Render a dot if a point is a T-junction or a terminal with a wire
    pointConnections.forEach((conn, key) => {
        const [xStr, yStr] = key.split(',');
        const x = parseFloat(xStr);
        const y = parseFloat(yStr);

        // A junction is:
        // 1. A point used by more than one wire (T-junction, cross-junction).
        // 2. A terminal that also has at least one wire connected.
        const isJunction = conn.wireIds.size > 1 || (conn.isTerminal && conn.wireIds.size > 0);

        if (isJunction) {
            const dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', x);
            dot.setAttribute('cy', y);
            dot.setAttribute('r', 4);
            dot.classList.add('junction-dot');
            svg.appendChild(dot);
        }
    });
}

// 輔助函式
export function getSvgCoords(e) {
    let pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}
export function snapToGrid(value, gridSize) {
    return Math.round(value / gridSize) * gridSize;
}
// findNearestTerminal 支援吸附
export function findNearestTerminal(x, y, radius) {
    let nearest = null; let minDistSq = radius * radius;
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
            const p2 = wire.points[i+1];
            if (Math.max(p1.x, p2.x) < x - radius || Math.min(p1.x, p2.x) > x + radius ||
                Math.max(p1.y, p2.y) < y - radius || Math.min(p1.y, p2.y) > y + radius) {
                continue;
            }
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx*dx + dy*dy;
            if (lenSq === 0) continue;
            let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = p1.x + t * dx;
            const projY = p1.y + t * dy;
            const dist = Math.sqrt((x - projX)**2 + (y - projY)**2);
            if (dist < minDist) {
                minDist = dist;
                // 對齊到網格，確保連接點的精確性
                nearest = { 
                    type: 'wire', 
                    wireId: wire.id, 
                    x: snapToGrid(projX, gridSize), 
                    y: snapToGrid(projY, gridSize),
                    segment: [p1, p2] // 返回被點擊的線段
                };
            }
        }
    }
    return nearest;
}
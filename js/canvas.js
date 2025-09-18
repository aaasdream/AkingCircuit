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

export function render() {
    // --- Pre-rendering Phase: Update wire geometries ---

    // 1. Sticky terminals: Update wire endpoints attached to components
    circuit.wires.forEach(wire => {
        const startPoint = wire.points[0];
        if (startPoint.terminal) {
            const component = circuit.components.find(c => c.id === startPoint.terminal.componentId);
            if (component) {
                const terminalPos = component.terminals[startPoint.terminal.terminalId];
                startPoint.x = terminalPos.x;
                startPoint.y = terminalPos.y;
            }
        }
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

    // 2. Sticky wire-to-wire connections
    circuit.wires.forEach(wireToMove => {
        wireToMove.points.forEach((pointToMove, index) => {
            // Only move points that are not endpoints connected to a terminal
            if (pointToMove.terminal) return;
            // Also, don't move the first or last point of a wire if it's a free-floating endpoint
            if (index === 0 || index === wireToMove.points.length - 1) return;


            for (const wireToStickTo of circuit.wires) {
                if (wireToMove.id === wireToStickTo.id) continue;

                for (let i = 0; i < wireToStickTo.points.length - 1; i++) {
                    const p1 = wireToStickTo.points[i];
                    const p2 = wireToStickTo.points[i + 1];
                    
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    if (dx === 0 && dy === 0) continue;

                    const lenSq = dx * dx + dy * dy;
                    const t = ((pointToMove.x - p1.x) * dx + (pointToMove.y - p1.y) * dy) / lenSq;

                    const projX = p1.x + t * dx;
                    const projY = p1.y + t * dy;
                    const distSq = (pointToMove.x - projX)**2 + (pointToMove.y - projY)**2;

                    // If the point is very close to the segment, and within the segment bounds
                    if (distSq < 0.1 && t > 0 && t < 1) { // Use > 0 and < 1 to avoid snapping to endpoints
                        pointToMove.x = projX;
                        pointToMove.y = projY;
                        return; // Snap to the first segment found
                    }
                }
            }
        });
    });

    // 3. Enforce orthogonality by adjusting existing corners
    circuit.wires.forEach(wire => {
        for (let i = 1; i < wire.points.length - 1; i++) {
            const p_prev = wire.points[i - 1];
            const p_curr = wire.points[i];
            const p_next = wire.points[i + 1];

            const isPrevHorizontal = p_prev.y === p_curr.y;
            const isPrevVertical = p_prev.x === p_curr.x;
            
            // If the previous segment is not orthogonal, we can't do much, so skip.
            if (!isPrevHorizontal && !isPrevVertical) continue;

            // If the current corner is already orthogonal, skip.
            if ((isPrevHorizontal && p_curr.x === p_next.x) || (isPrevVertical && p_curr.y === p_next.y)) {
                continue;
            }
            
            // Adjust the corner to make the next segment orthogonal
            if (isPrevHorizontal) {
                // Previous was horizontal, so make next vertical
                p_next.x = p_curr.x;
            } else { // Previous was vertical
                // Previous was vertical, so make next horizontal
                p_next.y = p_curr.y;
            }
        }
    });


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
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

export function render() {
    // Sticky Wires: 更新與元件相連的導線端點
    circuit.wires.forEach(wire => {
        // 更新起始點
        const startTerminalInfo = wire.points[0].terminal;
        if (startTerminalInfo) {
            const component = circuit.components.find(c => c.id === startTerminalInfo.componentId);
            if (component) {
                const terminalPos = component.terminals[startTerminalInfo.terminalId];
                wire.points[0].x = terminalPos.x;
                wire.points[0].y = terminalPos.y;
            }
        }
        // 更新結束點
        const endTerminalInfo = wire.points[wire.points.length - 1].terminal;
        if (endTerminalInfo) {
            const component = circuit.components.find(c => c.id === endTerminalInfo.componentId);
            if (component) {
                const terminalPos = component.terminals[endTerminalInfo.terminalId];
                wire.points[wire.points.length - 1].x = terminalPos.x;
                wire.points[wire.points.length - 1].y = terminalPos.y;
            }
        }
    });

    // 清空畫布
    while (svg.children.length > 2) {
        svg.removeChild(svg.children[2]);
    }

    // 渲染導線
    circuit.wires.forEach(wire => {
        const polyline = document.createElementNS(svgNS, 'polyline');
        polyline.setAttribute('points', pointsToSvgPath(wire.points));
        polyline.classList.add('wire');
        polyline.dataset.id = wire.id;
        if (state.selectedWireIds && state.selectedWireIds.includes(wire.id)) {
            polyline.classList.add('selected');
        }
        svg.appendChild(polyline);
        // 渲染頂點控點
        if (state.selectedWireIds && state.selectedWireIds.includes(wire.id)) {
            wire.points.forEach((p, index) => {
                const handle = document.createElementNS(svgNS, 'circle');
                handle.setAttribute('cx', p.x);
                handle.setAttribute('cy', p.y);
                handle.setAttribute('r', 4);
                handle.classList.add('wire-handle');
                handle.dataset.wireId = wire.id;
                handle.dataset.vertexIndex = index;
                svg.appendChild(handle);
            });
        }
    });

    // 渲染元件及其端點
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

    // Junction Dots
    const junctionPoints = new Map();
    circuit.wires.forEach(wire => {
        [wire.points[0], wire.points[wire.points.length-1]].forEach(p => {
            if(p.terminal) {
                const key = `${p.terminal.componentId}_${p.terminal.terminalId}`;
                junctionPoints.set(key, (junctionPoints.get(key) || 0) + 1);
            }
        });
    });
    circuit.wires.forEach(wire => {
        wire.points.forEach(p => {
            if(p.terminal) {
                const key = `T_${p.x}_${p.y}`;
                junctionPoints.set(key, (junctionPoints.get(key) || 0) + 1);
            }
        });
    });
    junctionPoints.forEach((count, key) => {
        if (count > 1) {
            let point;
            if (key.startsWith('T_')) {
                const [,x,y] = key.split('_');
                point = {x: parseFloat(x), y: parseFloat(y)};
            } else {
                const [comp_id, term_id] = key.split('_');
                const comp = circuit.components.find(c => c.id === comp_id);
                if (comp) point = comp.terminals[term_id];
            }
            if (point) {
                const dot = document.createElementNS(svgNS, 'circle');
                dot.setAttribute('cx', point.x);
                dot.setAttribute('cy', point.y);
                dot.setAttribute('r', 4);
                dot.classList.add('junction-dot');
                svg.appendChild(dot);
            }
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
                nearest = { type: 'wire', wireId: wire.id, x: projX, y: projY };
            }
        }
    }
    return nearest;
}
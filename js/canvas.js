import { svg, svgNS, state, circuit } from './state.js';
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

// 全局渲染函式 (核心)
export function render() {
    // 清空除了網格和defs之外的所有元素
    while (svg.children.length > 2) {
        svg.removeChild(svg.children[2]);
    }

    // 渲染線路
    circuit.wires.forEach(wire => {
        const fromComp = circuit.components.find(c => c.id === wire.from.componentId);
        const toComp = circuit.components.find(c => c.id === wire.to.componentId);
        if (!fromComp || !toComp) return;

        const startPos = fromComp.terminals[wire.from.terminalId];
        const endPos = toComp.terminals[wire.to.terminalId];

        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', startPos.x); line.setAttribute('y1', startPos.y);
        line.setAttribute('x2', endPos.x); line.setAttribute('y2', endPos.y);
        line.classList.add('wire');
        svg.appendChild(line);
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
export function findNearestTerminal(x, y, radius) {
    let nearest = null; let minDist = radius * radius;
    for (const comp of circuit.components) {
        for (const termId in comp.terminals) {
            const term = comp.terminals[termId];
            const dx = x - term.x, dy = y - term.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDist) {
                minDist = distSq;
                nearest = { componentId: comp.id, terminalId: termId };
            }
        }
    }
    return nearest;
}
/**
 * 畫布管理器
 * 負責 SVG 渲染、網格、視窗管理等功能
 */
export class CanvasManager {
    constructor(simulator) {
        this.simulator = simulator;
        this.svg = simulator.svg;
        this.svgNS = simulator.svgNS;
        this.gridSize = simulator.gridSize;
        
        this.ghostComponent = null;
        this.tempWireEl = null;
        this.marqueeRect = null;
    }
    
    /**
     * 初始化畫布
     */
    init() {
        this.createGridPattern();
        this.updateViewBox();
    }
    
    /**
     * 創建網格背景
     */
    createGridPattern() {
        const defs = document.createElementNS(this.svgNS, 'defs');
        const pattern = document.createElementNS(this.svgNS, 'pattern');
        pattern.setAttribute('id', 'grid');
        pattern.setAttribute('width', this.gridSize);
        pattern.setAttribute('height', this.gridSize);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        
        const circle = document.createElementNS(this.svgNS, 'circle');
        circle.setAttribute('cx', '1');
        circle.setAttribute('cy', '1');
        circle.setAttribute('r', '1');
        circle.setAttribute('fill', '#555');
        
        pattern.appendChild(circle);
        defs.appendChild(pattern);
        this.svg.appendChild(defs);
        
        const gridRect = document.createElementNS(this.svgNS, 'rect');
        gridRect.setAttribute('width', '100%');
        gridRect.setAttribute('height', '100%');
        gridRect.setAttribute('fill', 'url(#grid)');
        this.svg.insertBefore(gridRect, this.svg.firstChild);
    }
    
    /**
     * 更新視窗
     */
    updateViewBox() {
        const viewBox = this.simulator.viewBox;
        this.svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    }
    
    /**
     * 創建幽靈元件（放置預覽）
     */
    createGhostComponent(type) {
        this.clearGhostElements();
        
        this.ghostComponent = document.createElementNS(this.svgNS, 'g');
        this.ghostComponent.innerHTML = this.simulator.componentFactory.getComponentSVG(type);
        this.ghostComponent.classList.add('ghost');
        this.svg.appendChild(this.ghostComponent);
    }
    
    /**
     * 更新幽靈元件位置
     */
    updateGhostComponent(x, y, rotation = 0) {
        if (this.ghostComponent) {
            const snappedX = this.snapToGrid(x);
            const snappedY = this.snapToGrid(y);
            this.ghostComponent.setAttribute('transform', 
                `translate(${snappedX}, ${snappedY}) rotate(${rotation})`);
        }
    }
    
    /**
     * 創建臨時導線元素
     */
    createTempWire() {
        this.tempWireEl = document.createElementNS(this.svgNS, 'polyline');
        this.tempWireEl.classList.add('wire');
        this.tempWireEl.style.opacity = '0.7';
        this.svg.appendChild(this.tempWireEl);
    }
    
    /**
     * 更新臨時導線
     */
    updateTempWire(points) {
        if (this.tempWireEl) {
            const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
            this.tempWireEl.setAttribute('points', pointsStr);
        }
    }
    
    /**
     * 創建框選矩形
     */
    createMarqueeRect() {
        this.marqueeRect = document.createElementNS(this.svgNS, 'rect');
        this.marqueeRect.classList.add('marquee-rect');
        this.svg.appendChild(this.marqueeRect);
    }
    
    /**
     * 更新框選矩形
     */
    updateMarqueeRect(startX, startY, endX, endY) {
        if (this.marqueeRect) {
            const x = Math.min(startX, endX);
            const y = Math.min(startY, endY);
            const width = Math.abs(endX - startX);
            const height = Math.abs(endY - startY);
            
            this.marqueeRect.setAttribute('x', x);
            this.marqueeRect.setAttribute('y', y);
            this.marqueeRect.setAttribute('width', width);
            this.marqueeRect.setAttribute('height', height);
        }
    }
    
    /**
     * 清除幽靈元素
     */
    clearGhostElements() {
        if (this.ghostComponent) {
            this.ghostComponent.remove();
            this.ghostComponent = null;
        }
        if (this.tempWireEl) {
            this.tempWireEl.remove();
            this.tempWireEl = null;
        }
        if (this.marqueeRect) {
            this.marqueeRect.remove();
            this.marqueeRect = null;
        }
    }
    
    /**
     * 更新滑鼠游標樣式
     */
    updateCursor() {
        const cursors = {
            'SELECT': 'default',
            'WIRING': 'crosshair',
            'PLACING': 'crosshair'
        };
        this.svg.style.cursor = cursors[this.simulator.mode] || 'default';
    }
    
    /**
     * 主要渲染函數
     */
    render() {
        // 預處理導線
        this.preprocessWires();
        
        // 清除舊的渲染元素（保留前兩個：defs 和 grid）
        while (this.svg.children.length > 2) {
            this.svg.removeChild(this.svg.children[2]);
        }
        
        // 渲染導線
        this.renderWires();
        
        // 渲染導線節點
        this.renderWireNodes();
        
        // 渲染元件
        this.renderComponents();
        
        // 渲染元件端點
        this.renderComponentTerminals();
        
        // 渲染連接點
        this.renderJunctionDots();
    }
    
    /**
     * 預處理導線
     */
    preprocessWires() {
        // 吸附導線端點到元件端點
        this.simulator.wires.forEach(wire => {
            this.snapWireEndpoints(wire);
        });
        
        // 計算節點連接
        const pointConnections = this.calculatePointConnections();
        
        // 識別交叉點
        const junctionPoints = this.identifyJunctionPoints(pointConnections);
        
        // 簡化導線路徑
        this.simulator.wires.forEach(wire => {
            this.simplifyWire(wire, junctionPoints);
        });
    }
    
    /**
     * 吸附導線端點到元件端點
     */
    snapWireEndpoints(wire) {
        const snapPoint = (point) => {
            if (point && point.terminal) {
                const component = this.simulator.getComponentById(point.terminal.componentId);
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
     * 計算點連接關係
     */
    calculatePointConnections() {
        const pointConnections = new Map();
        
        // 添加元件端點
        this.simulator.components.forEach(comp => {
            Object.values(comp.terminals).forEach(term => {
                const key = `${term.x},${term.y}`;
                if (!pointConnections.has(key)) {
                    pointConnections.set(key, { isTerminal: true, wireIds: new Set() });
                } else {
                    pointConnections.get(key).isTerminal = true;
                }
            });
        });
        
        // 添加導線點
        this.simulator.wires.forEach(wire => {
            wire.points.forEach(p => {
                const key = `${p.x},${p.y}`;
                if (!pointConnections.has(key)) {
                    pointConnections.set(key, { isTerminal: false, wireIds: new Set() });
                }
                pointConnections.get(key).wireIds.add(wire.id);
            });
        });
        
        return pointConnections;
    }
    
    /**
     * 識別交叉點
     */
    identifyJunctionPoints(pointConnections) {
        const junctionPoints = new Set();
        
        pointConnections.forEach((conn, key) => {
            const isJunction = conn.isTerminal || conn.wireIds.size > 1;
            if (isJunction) {
                junctionPoints.add(key);
            }
        });
        
        return junctionPoints;
    }
    
    /**
     * 簡化導線路徑
     */
    simplifyWire(wire, junctionPoints = new Set()) {
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
     * 渲染導線
     */
    renderWires() {
        this.simulator.wires.forEach(wire => {
            const polyline = document.createElementNS(this.svgNS, 'polyline');
            const pointsStr = wire.points.map(p => `${p.x},${p.y}`).join(' ');
            
            polyline.setAttribute('points', pointsStr);
            polyline.classList.add('wire');
            polyline.dataset.id = wire.id;
            
            if (this.simulator.selectedWireIds.includes(wire.id)) {
                polyline.style.stroke = '#00FFFF';
            }
            
            this.svg.appendChild(polyline);
        });
    }
    
    /**
     * 渲染導線節點
     */
    renderWireNodes() {
        const renderedNodes = new Set();
        
        this.simulator.wires.forEach(wire => {
            wire.points.forEach(point => {
                const pointKey = `${point.x},${point.y}`;
                
                if (point.isNode && !renderedNodes.has(pointKey)) {
                    const handleSize = 14;
                    const rect = document.createElementNS(this.svgNS, 'rect');
                    
                    rect.setAttribute('x', point.x - handleSize / 2);
                    rect.setAttribute('y', point.y - handleSize / 2);
                    rect.setAttribute('width', handleSize);
                    rect.setAttribute('height', handleSize);
                    rect.classList.add('wire-vertex-handle');
                    
                    if (this.simulator.selectedNodeKeys.includes(pointKey)) {
                        rect.classList.add('selected');
                    }
                    
                    this.svg.appendChild(rect);
                    renderedNodes.add(pointKey);
                }
            });
        });
    }
    
    /**
     * 渲染元件
     */
    renderComponents() {
        this.simulator.components.forEach(comp => {
            const g = document.createElementNS(this.svgNS, 'g');
            g.innerHTML = comp.getSVG();
            g.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${comp.rotation})`);
            g.classList.add('component');
            g.dataset.id = comp.id;
            
            if (this.simulator.selectedComponentIds.includes(comp.id)) {
                g.classList.add('selected');
            }
            
            this.svg.appendChild(g);
        });
    }
    
    /**
     * 渲染元件端點
     */
    renderComponentTerminals() {
        this.simulator.components.forEach(comp => {
            Object.values(comp.terminals).forEach(term => {
                const terminalDot = document.createElementNS(this.svgNS, 'circle');
                terminalDot.setAttribute('cx', term.x);
                terminalDot.setAttribute('cy', term.y);
                terminalDot.setAttribute('r', 4);
                terminalDot.classList.add('component-terminal');
                this.svg.appendChild(terminalDot);
            });
        });
    }
    
    /**
     * 渲染連接點
     */
    renderJunctionDots() {
        const pointConnections = this.calculatePointConnections();
        
        pointConnections.forEach((conn, key) => {
            const isConnectionPoint = conn.wireIds.size > 1 || 
                                     (conn.isTerminal && conn.wireIds.size > 0);
            
            if (isConnectionPoint) {
                const [xStr, yStr] = key.split(',');
                const dot = document.createElementNS(this.svgNS, 'circle');
                dot.setAttribute('cx', parseFloat(xStr));
                dot.setAttribute('cy', parseFloat(yStr));
                dot.setAttribute('r', 4);
                dot.classList.add('junction-dot');
                this.svg.appendChild(dot);
            }
        });
    }
    
    /**
     * 將 SVG 座標轉換為螢幕座標
     */
    getSvgCoords(e) {
        let pt = this.svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        return pt.matrixTransform(this.svg.getScreenCTM().inverse());
    }
    
    /**
     * 對齊到網格
     */
    snapToGrid(value) {
        return Math.round(value / this.gridSize) * this.gridSize;
    }
    
    /**
     * 檢查路徑是否與元件碰撞
     */
    isPathColliding(points, ignoreComponentIds = []) {
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
            
            if (this.isRectCollidingWithComponents(rect, ignoreComponentIds)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * 檢查矩形是否與元件碰撞
     */
    isRectCollidingWithComponents(rect, ignoreComponentIds = []) {
        for (const comp of this.simulator.components) {
            if (ignoreComponentIds.includes(comp.id)) {
                continue;
            }
            
            const compRect = {
                x: comp.x - this.gridSize * 2,
                y: comp.y - this.gridSize * 1.5,
                width: this.gridSize * 4,
                height: this.gridSize * 3
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
}
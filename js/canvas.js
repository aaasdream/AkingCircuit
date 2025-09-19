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
 * 簡化導線，移除共線的多餘點（改進版，保持交叉點）
 * @param {object} wire - 要簡化的導線物件。
 */
function simplifyWire(wire) {
    if (wire.points.length < 3) return;

    // 創建一個交叉點位置的集合，用於保護這些點不被刪除
    const intersectionPoints = new Set();
    
    // 找出所有可能的交叉點
    circuit.wires.forEach(otherWire => {
        if (otherWire.id === wire.id) return;
        
        otherWire.points.forEach(otherPoint => {
            wire.points.forEach(point => {
                if (point.x === otherPoint.x && point.y === otherPoint.y) {
                    intersectionPoints.add(`${point.x},${point.y}`);
                }
            });
        });
    });
    
    // 也保護所有端點連接
    wire.points.forEach(point => {
        if (point.terminal) {
            intersectionPoints.add(`${point.x},${point.y}`);
        }
    });

    const simplifiedPoints = [wire.points[0]];
    for (let i = 1; i < wire.points.length - 1; i++) {
        const p_prev = simplifiedPoints[simplifiedPoints.length - 1];
        const p_curr = wire.points[i];
        const p_next = wire.points[i + 1];

        const isCollinear = (p_prev.x === p_curr.x && p_curr.x === p_next.x) ||
                            (p_prev.y === p_curr.y && p_curr.y === p_next.y);
        
        // 如果這個點是交叉點，即使共線也要保留
        const isIntersection = intersectionPoints.has(`${p_curr.x},${p_curr.y}`);

        if (!isCollinear || isIntersection) {
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

    // 步驟 1: 端點吸附 - 更新連接到元件的導線端點 (改進版)
    circuit.wires.forEach(wire => {
        // 處理起始點
        const startPoint = wire.points[0];
        if (startPoint.terminal) {
            const component = circuit.components.find(c => c.id === startPoint.terminal.componentId);
            if (component) {
                const terminalPos = component.terminals[startPoint.terminal.terminalId];
                const deltaX = terminalPos.x - startPoint.x;
                const deltaY = terminalPos.y - startPoint.y;
                
                // 如果端點位置有變化，需要更新整條線路
                if (deltaX !== 0 || deltaY !== 0) {
                    updateConnectedWireSegments(wire, 0, deltaX, deltaY);
                }
                
                startPoint.x = terminalPos.x;
                startPoint.y = terminalPos.y;
            }
        }
        
        // 處理結束點
        const endPoint = wire.points[wire.points.length - 1];
        if (endPoint.terminal) {
            const component = circuit.components.find(c => c.id === endPoint.terminal.componentId);
            if (component) {
                const terminalPos = component.terminals[endPoint.terminal.terminalId];
                const deltaX = terminalPos.x - endPoint.x;
                const deltaY = terminalPos.y - endPoint.y;
                
                // 如果端點位置有變化，需要更新整條線路
                if (deltaX !== 0 || deltaY !== 0) {
                    updateConnectedWireSegments(wire, wire.points.length - 1, deltaX, deltaY);
                }
                
                endPoint.x = terminalPos.x;
                endPoint.y = terminalPos.y;
            }
        }
    });
    
    // 新增函數：更新連接的線路段
    function updateConnectedWireSegments(sourceWire, pointIndex, deltaX, deltaY) {
        const sourcePoint = sourceWire.points[pointIndex];
        const isStartPoint = pointIndex === 0;
        const isEndPoint = pointIndex === sourceWire.points.length - 1;
        
        // 如果是起始點或結束點，需要更新相鄰的線段
        if (isStartPoint && sourceWire.points.length > 1) {
            const nextPoint = sourceWire.points[1];
            // 如果下一個點在同一條直線上，需要移動它
            if (sourcePoint.x === nextPoint.x) {
                // 垂直線，移動 X 座標
                nextPoint.x += deltaX;
            } else if (sourcePoint.y === nextPoint.y) {
                // 水平線，移動 Y 座標  
                nextPoint.y += deltaY;
            }
        }
        
        if (isEndPoint && sourceWire.points.length > 1) {
            const prevPoint = sourceWire.points[sourceWire.points.length - 2];
            // 如果前一個點在同一條直線上，需要移動它
            if (sourcePoint.x === prevPoint.x) {
                // 垂直線，移動 X 座標
                prevPoint.x += deltaX;
            } else if (sourcePoint.y === prevPoint.y) {
                // 水平線，移動 Y 座標
                prevPoint.y += deltaY;
            }
        }
        
        // 更新所有在相同位置的交叉點
        updateIntersectionPoints(sourcePoint, deltaX, deltaY);
    }
    
    // 新增函數：更新交叉點位置
    function updateIntersectionPoints(movedPoint, deltaX, deltaY) {
        const oldX = movedPoint.x - deltaX;
        const oldY = movedPoint.y - deltaY;
        
        // 尋找所有包含這個交叉點的其他線路
        circuit.wires.forEach(wire => {
            wire.points.forEach((point, index) => {
                // 如果這個點是交叉點（不是端點連接），且位置匹配
                if (!point.terminal && point.x === oldX && point.y === oldY) {
                    point.x = movedPoint.x;
                    point.y = movedPoint.y;
                    
                    // 遞迴更新相連的線段
                    updateConnectedSegmentsAtIntersection(wire, index, deltaX, deltaY);
                }
            });
        });
    }
    
    // 新增函數：更新交叉點處相連的線段
    function updateConnectedSegmentsAtIntersection(wire, pointIndex, deltaX, deltaY) {
        const intersectionPoint = wire.points[pointIndex];
        
        // 檢查前一個線段
        if (pointIndex > 0) {
            const prevPoint = wire.points[pointIndex - 1];
            if (!prevPoint.terminal) { // 如果前一個點不是端點
                if (intersectionPoint.x === prevPoint.x) {
                    // 垂直線段，移動 X 座標
                    prevPoint.x += deltaX;
                } else if (intersectionPoint.y === prevPoint.y) {
                    // 水平線段，移動 Y 座標
                    prevPoint.y += deltaY;
                }
            }
        }
        
        // 檢查後一個線段
        if (pointIndex < wire.points.length - 1) {
            const nextPoint = wire.points[pointIndex + 1];
            if (!nextPoint.terminal) { // 如果後一個點不是端點
                if (intersectionPoint.x === nextPoint.x) {
                    // 垂直線段，移動 X 座標
                    nextPoint.x += deltaX;
                } else if (intersectionPoint.y === nextPoint.y) {
                    // 水平線段，移動 Y 座標
                    nextPoint.y += deltaY;
                }
            }
        }
    }

    // 步驟 1.5: 創建「穿透式」連接 - 改進版本
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

    // 為每條線處理穿透連接
    circuit.wires.forEach(wire => {
        const insertions = [];
        for (let i = 0; i < wire.points.length - 1; i++) {
            const p1 = wire.points[i];
            const p2 = wire.points[i + 1];

            // 檢查所有元件端點
            allTerminals.forEach(term => {
                // 改進的線段判斷邏輯
                const termIsOnSegment = isPointOnSegment(term, p1, p2);

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
            
            // 檢查與其他線的交點
            circuit.wires.forEach(otherWire => {
                if (otherWire.id === wire.id) return; // 跳過自己
                
                for (let j = 0; j < otherWire.points.length - 1; j++) {
                    const op1 = otherWire.points[j];
                    const op2 = otherWire.points[j + 1];
                    
                    // 找到線段交點
                    const intersection = findLineIntersection(p1, p2, op1, op2);
                    if (intersection) {
                        const pointExists = wire.points.some(p => p.x === intersection.x && p.y === intersection.y);
                        if (!pointExists) {
                            insertions.push({
                                index: i + 1,
                                point: intersection
                            });
                        }
                    }
                }
            });
        }
        
        if (insertions.length > 0) {
            // 按距離排序插入點，確保順序正確
            insertions.sort((a, b) => b.index - a.index).forEach(ins => {
                wire.points.splice(ins.index, 0, ins.point);
            });
        }
    });

    // 輔助函數：檢查點是否在線段上
    function isPointOnSegment(point, segStart, segEnd) {
        // 檢查是否在水平線段上
        if (segStart.y === segEnd.y && point.y === segStart.y) {
            const minX = Math.min(segStart.x, segEnd.x);
            const maxX = Math.max(segStart.x, segEnd.x);
            return point.x >= minX && point.x <= maxX;
        }
        
        // 檢查是否在垂直線段上
        if (segStart.x === segEnd.x && point.x === segStart.x) {
            const minY = Math.min(segStart.y, segEnd.y);
            const maxY = Math.max(segStart.y, segEnd.y);
            return point.y >= minY && point.y <= maxY;
        }
        
        return false;
    }

    // 輔助函數：找到兩個線段的交點（僅限正交線段）
    function findLineIntersection(a1, a2, b1, b2) {
        // 檢查一條是水平線，另一條是垂直線
        const aIsHorizontal = a1.y === a2.y;
        const aIsVertical = a1.x === a2.x;
        const bIsHorizontal = b1.y === b2.y;
        const bIsVertical = b1.x === b2.x;
        
        if ((aIsHorizontal && bIsVertical) || (aIsVertical && bIsHorizontal)) {
            let hLine, vLine;
            
            if (aIsHorizontal && bIsVertical) {
                hLine = { start: a1, end: a2 };
                vLine = { start: b1, end: b2 };
            } else {
                hLine = { start: b1, end: b2 };
                vLine = { start: a1, end: a2 };
            }
            
            // 檢查是否真的相交
            const hMinX = Math.min(hLine.start.x, hLine.end.x);
            const hMaxX = Math.max(hLine.start.x, hLine.end.x);
            const vMinY = Math.min(vLine.start.y, vLine.end.y);
            const vMaxY = Math.max(vLine.start.y, vLine.end.y);
            
            if (vLine.start.x >= hMinX && vLine.start.x <= hMaxX &&
                hLine.start.y >= vMinY && hLine.start.y <= vMaxY) {
                return {
                    x: vLine.start.x,
                    y: hLine.start.y
                };
            }
        }
        
        return null;
    }

    // 步驟 2: 正交性修復 - 處理因元件移動導致的線路變形 (改進版)
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
            // 改進的多點線路處理
            const p1 = wire.points[0];
            const p2 = wire.points[1];
            const p3 = wire.points[2];
            
            // 處理起始點的正交性
            if (!p1.terminal && !p2.terminal) {
                // 如果都不是端點連接，保持原邏輯
                if (p2.y === p3.y) { p2.x = p1.x; } 
                else if (p2.x === p3.x) { p2.y = p1.y; }
            } else if (p1.terminal && !p2.terminal) {
                // 如果 p1 是端點，調整 p2 以保持正交
                if (Math.abs(p1.x - p3.x) < Math.abs(p1.y - p3.y)) {
                    // 更傾向於垂直路徑
                    p2.x = p1.x;
                    p2.y = p3.y;
                } else {
                    // 更傾向於水平路徑
                    p2.y = p1.y;
                    p2.x = p3.x;
                }
            }
            
            // 處理結束點的正交性
            const pn = wire.points[wire.points.length - 1];
            const pn_1 = wire.points[wire.points.length - 2];
            const pn_2 = wire.points[wire.points.length - 3];
            
            if (!pn.terminal && !pn_1.terminal) {
                // 如果都不是端點連接，保持原邏輯
                if (pn_2.y === pn_1.y) { pn_1.x = pn.x; } 
                else if (pn_2.x === pn_1.x) { pn_1.y = pn.y; }
            } else if (pn.terminal && !pn_1.terminal) {
                // 如果 pn 是端點，調整 pn_1 以保持正交
                if (Math.abs(pn.x - pn_2.x) < Math.abs(pn.y - pn_2.y)) {
                    // 更傾向於垂直路徑
                    pn_1.x = pn.x;
                    pn_1.y = pn_2.y;
                } else {
                    // 更傾向於水平路徑
                    pn_1.y = pn.y;
                    pn_1.x = pn_2.x;
                }
            }
            
            // 檢查並修復中間點的正交性
            for (let i = 1; i < wire.points.length - 1; i++) {
                const prev = wire.points[i - 1];
                const curr = wire.points[i];
                const next = wire.points[i + 1];
                
                // 如果當前點不是端點連接，嘗試保持正交性
                if (!curr.terminal) {
                    // 檢查是否需要調整位置以保持正交
                    const prevToCurrentOrthogonal = (prev.x === curr.x || prev.y === curr.y);
                    const currentToNextOrthogonal = (curr.x === next.x || curr.y === next.y);
                    
                    if (!prevToCurrentOrthogonal || !currentToNextOrthogonal) {
                        // 嘗試找到一個正交的位置
                        if (prev.x === curr.x) {
                            // 前段是垂直的，保持垂直並調整水平
                            curr.y = next.y;
                        } else if (prev.y === curr.y) {
                            // 前段是水平的，保持水平並調整垂直
                            curr.x = next.x;
                        }
                    }
                }
            }
        }
    });

    // 步驟 3: 線路簡化 - 移除共線的多餘節點
    circuit.wires.forEach(simplifyWire);
    
    // 步驟 3.5: 維護交叉點完整性 (新增)
    maintainIntersectionIntegrity();
    
    // 維護交叉點完整性的函數
    function maintainIntersectionIntegrity() {
        // 檢查所有線路對之間的交叉點
        for (let i = 0; i < circuit.wires.length; i++) {
            for (let j = i + 1; j < circuit.wires.length; j++) {
                const wire1 = circuit.wires[i];
                const wire2 = circuit.wires[j];
                
                // 檢查每個線段組合的交叉
                for (let seg1 = 0; seg1 < wire1.points.length - 1; seg1++) {
                    for (let seg2 = 0; seg2 < wire2.points.length - 1; seg2++) {
                        const intersection = findLineIntersection(
                            wire1.points[seg1], wire1.points[seg1 + 1],
                            wire2.points[seg2], wire2.points[seg2 + 1]
                        );
                        
                        if (intersection) {
                            // 確保兩條線都有這個交叉點
                            ensureIntersectionPoint(wire1, intersection, seg1);
                            ensureIntersectionPoint(wire2, intersection, seg2);
                        }
                    }
                }
            }
        }
    }
    
    // 確保線路包含指定的交叉點
    function ensureIntersectionPoint(wire, intersection, segmentIndex) {
        const pointExists = wire.points.some(p => 
            p.x === intersection.x && p.y === intersection.y
        );
        
        if (!pointExists) {
            // 找到正確的插入位置
            let insertIndex = segmentIndex + 1;
            
            // 確保插入位置正確（按距離排序）
            const seg1 = wire.points[segmentIndex];
            const seg2 = wire.points[segmentIndex + 1];
            
            // 檢查交叉點確實在線段上
            if (isPointOnSegmentLocal(intersection, seg1, seg2)) {
                wire.points.splice(insertIndex, 0, intersection);
            }
        }
    }
    
    // 本地的點在線段上判斷函數
    function isPointOnSegmentLocal(point, segStart, segEnd) {
        // 檢查是否在水平線段上
        if (segStart.y === segEnd.y && point.y === segStart.y) {
            const minX = Math.min(segStart.x, segEnd.x);
            const maxX = Math.max(segStart.x, segEnd.x);
            return point.x >= minX && point.x <= maxX;
        }
        
        // 檢查是否在垂直線段上
        if (segStart.x === segEnd.x && point.x === segStart.x) {
            const minY = Math.min(segStart.y, segEnd.y);
            const maxY = Math.max(segStart.y, segEnd.y);
            return point.y >= minY && point.y <= maxY;
        }
        
        return false;
    }

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
        polyline.dataset.id = wire.id;
        svg.appendChild(polyline);
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

    // 渲染「連接點」 (Connection Dots) - 改進版本
    const pointConnections = new Map();
    
    // 首先添加所有元件端點
    circuit.components.forEach(comp => {
        Object.values(comp.terminals).forEach(term => {
            const key = `${term.x},${term.y}`;
            pointConnections.set(key, { 
                isTerminal: true, 
                wireIds: new Set(),
                x: term.x,
                y: term.y
            });
        });
    });
    
    // 然後添加所有線路點
    circuit.wires.forEach(wire => {
        wire.points.forEach(p => {
            const key = `${p.x},${p.y}`;
            if (!pointConnections.has(key)) {
                pointConnections.set(key, { 
                    isTerminal: false, 
                    wireIds: new Set(),
                    x: p.x,
                    y: p.y
                });
            }
            pointConnections.get(key).wireIds.add(wire.id);
        });
    });
    
    // 檢查線路交叉點並強制添加連接點
    circuit.wires.forEach((wire1, index1) => {
        circuit.wires.forEach((wire2, index2) => {
            if (index1 >= index2) return; // 避免重複檢查
            
            // 檢查每個線段組合
            for (let i = 0; i < wire1.points.length - 1; i++) {
                for (let j = 0; j < wire2.points.length - 1; j++) {
                    const intersection = findLineIntersection(
                        wire1.points[i], wire1.points[i + 1],
                        wire2.points[j], wire2.points[j + 1]
                    );
                    
                    if (intersection) {
                        const key = `${intersection.x},${intersection.y}`;
                        if (!pointConnections.has(key)) {
                            pointConnections.set(key, {
                                isTerminal: false,
                                wireIds: new Set([wire1.id, wire2.id]),
                                x: intersection.x,
                                y: intersection.y,
                                isIntersection: true
                            });
                        } else {
                            pointConnections.get(key).wireIds.add(wire1.id);
                            pointConnections.get(key).wireIds.add(wire2.id);
                            pointConnections.get(key).isIntersection = true;
                        }
                    }
                }
            }
        });
    });
    
    // 渲染連接點
    pointConnections.forEach((conn, key) => {
        // 顯示圓點的條件：
        // 1. 多條線連接到同一點 (wireIds.size > 1)
        // 2. 端點有線連接 (isTerminal && wireIds.size > 0)  
        // 3. 明確標記為交叉點 (isIntersection)
        const isConnectionPoint = conn.wireIds.size > 1 || 
                                 (conn.isTerminal && conn.wireIds.size > 0) ||
                                 conn.isIntersection;
        
        if (isConnectionPoint) {
            const dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', conn.x);
            dot.setAttribute('cy', conn.y);
            dot.setAttribute('r', 4);
            dot.classList.add('junction-dot');
            
            // 為不同類型的連接點添加不同的樣式
            if (conn.isTerminal) {
                dot.classList.add('terminal-connection');
            }
            if (conn.isIntersection) {
                dot.classList.add('wire-intersection');
            }
            
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
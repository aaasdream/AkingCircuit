/**
 * 導線管理器
 * 負責處理導線連接和路徑尋找
 */
import { Wire } from './Wire.js';

export class WireManager {
    constructor(simulator) {
        this.simulator = simulator;
        this.canvasManager = simulator.canvasManager;
        this.gridSize = simulator.gridSize;
    }
    
    /**
     * 創建新導線
     */
    createWire(points) {
        const id = this.simulator.getNextWireId();
        return new Wire(id, points);
    }
    
    /**
     * 完成當前導線的繪製
     */
    finalizeCurrentWire() {
        if (this.simulator.currentWirePoints.length >= 2) {
            const wire = this.createWire([...this.simulator.currentWirePoints]);
            this.simulator.wires.push(wire);
        }
        
        this.simulator.currentWirePoints = [];
        this.canvasManager.clearGhostElements();
        this.simulator.render();
    }
    
    /**
     * 獲取導線吸附點
     */
    getWireSnapPoint(e) {
        const { x, y } = this.canvasManager.getSvgCoords(e);
        const snappedX = this.canvasManager.snapToGrid(x);
        const snappedY = this.canvasManager.snapToGrid(y);
        
        let snapPoint = { x: snappedX, y: snappedY };
        let connected = false;
        
        const nearestTerminal = this.findNearestTerminal(x, y, 10);
        const nearestNode = this.findNearestNode(x, y, 10);
        const nearestWire = this.findNearestWire(x, y, 10);
        
        if (nearestTerminal) {
            snapPoint = {
                x: nearestTerminal.x,
                y: nearestTerminal.y,
                terminal: {
                    componentId: nearestTerminal.componentId,
                    terminalId: nearestTerminal.terminalId
                }
            };
            connected = true;
        } else if (nearestNode) {
            snapPoint = {
                x: nearestNode.point.x,
                y: nearestNode.point.y,
                node: nearestNode
            };
            connected = true;
        } else if (nearestWire) {
            snapPoint = {
                x: nearestWire.x,
                y: nearestWire.y,
                wire: nearestWire
            };
            connected = true;
        }
        
        return { snapPoint, connected };
    }
    
    /**
     * 尋找最近的元件端點
     */
    findNearestTerminal(x, y, radius) {
        let nearest = null;
        let minDistSq = radius * radius;
        
        for (const comp of this.simulator.components) {
            for (const termId in comp.terminals) {
                const term = comp.terminals[termId];
                const dx = x - term.x;
                const dy = y - term.y;
                const distSq = dx * dx + dy * dy;
                
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearest = {
                        type: 'terminal',
                        componentId: comp.id,
                        terminalId: termId,
                        x: term.x,
                        y: term.y
                    };
                }
            }
        }
        
        return nearest;
    }
    
    /**
     * 尋找最近的導線節點
     */
    findNearestNode(x, y, radius) {
        let nearest = null;
        let minDistSq = radius * radius;
        
        for (const wire of this.simulator.wires) {
            for (const point of wire.points) {
                if (point.isNode) {
                    const dx = x - point.x;
                    const dy = y - point.y;
                    const distSq = dx * dx + dy * dy;
                    
                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        nearest = {
                            type: 'node',
                            point: point
                        };
                    }
                }
            }
        }
        
        return nearest;
    }
    
    /**
     * 尋找最近的導線
     */
    findNearestWire(x, y, radius) {
        let nearest = null;
        let minDist = radius;
        
        for (const wire of this.simulator.wires) {
            for (let i = 0; i < wire.points.length - 1; i++) {
                const p1 = wire.points[i];
                const p2 = wire.points[i + 1];
                
                // 快速邊界檢查
                if (Math.max(p1.x, p2.x) < x - radius || 
                    Math.min(p1.x, p2.x) > x + radius ||
                    Math.max(p1.y, p2.y) < y - radius || 
                    Math.min(p1.y, p2.y) > y + radius) {
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
                        x: this.canvasManager.snapToGrid(projX),
                        y: this.canvasManager.snapToGrid(projY),
                        segment: [p1, p2]
                    };
                }
            }
        }
        
        return nearest;
    }
    
    /**
     * 在導線上創建交叉點
     */
    createJunctionOnWire(snapPoint) {
        if (!snapPoint || !snapPoint.wire) return null;
        
        const originalWire = this.simulator.getWireById(snapPoint.wire.wireId);
        if (!originalWire) return null;
        
        const segmentStartPoint = snapPoint.wire.segment[0];
        const segmentEndPoint = snapPoint.wire.segment[1];
        
        const segmentStartIndex = originalWire.points.findIndex(p => 
            p.x === segmentStartPoint.x && p.y === segmentStartPoint.y
        );
        
        if (segmentStartIndex > -1 && 
            segmentStartIndex < originalWire.points.length - 1 &&
            originalWire.points[segmentStartIndex + 1].x === segmentEndPoint.x &&
            originalWire.points[segmentStartIndex + 1].y === segmentEndPoint.y) {
            
            const newJunctionPoint = { 
                x: snapPoint.x, 
                y: snapPoint.y, 
                isNode: true 
            };
            
            // 分割原導線
            const points1 = originalWire.points.slice(0, segmentStartIndex + 1);
            points1.push(newJunctionPoint);
            
            const points2 = [newJunctionPoint, ...originalWire.points.slice(segmentStartIndex + 1)];
            
            // 移除原導線
            this.simulator.removeWire(originalWire.id);
            
            // 添加新的導線段
            this.simulator.wires.push(this.createWire(points1));
            this.simulator.wires.push(this.createWire(points2));
            
            return newJunctionPoint;
        }
        
        return null;
    }
    
    /**
     * 自動路由導線路徑
     * 簡單的曼哈頓路由算法
     */
    autoRoute(startPoint, endPoint, avoidComponents = true) {
        const path = [startPoint];
        
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        
        if (dx === 0 && dy === 0) {
            return [startPoint];
        }
        
        // 簡單的L型路由
        if (Math.abs(dx) > Math.abs(dy)) {
            // 先水平後垂直
            if (dx !== 0) {
                const midPoint = { 
                    x: endPoint.x, 
                    y: startPoint.y, 
                    isNode: true 
                };
                
                if (!avoidComponents || !this.isPathColliding([startPoint, midPoint])) {
                    path.push(midPoint);
                }
            }
        } else {
            // 先垂直後水平
            if (dy !== 0) {
                const midPoint = { 
                    x: startPoint.x, 
                    y: endPoint.y, 
                    isNode: true 
                };
                
                if (!avoidComponents || !this.isPathColliding([startPoint, midPoint])) {
                    path.push(midPoint);
                }
            }
        }
        
        path.push(endPoint);
        return path;
    }
    
    /**
     * 檢查路徑是否與元件碰撞
     */
    isPathColliding(points) {
        return this.canvasManager.isPathColliding(points);
    }
    
    /**
     * 合併重疊的導線
     */
    mergeOverlappingWires() {
        // 這個功能可以用來優化導線，移除重疊的導線段
        // 實現比較複雜，這裡先留空，可以後續實現
        console.log('Wire merging not implemented yet');
    }
    
    /**
     * 分析導線連接性
     */
    analyzeConnectivity() {
        const connections = new Map();
        
        // 分析每條導線的連接點
        this.simulator.wires.forEach(wire => {
            wire.points.forEach(point => {
                const key = `${point.x},${point.y}`;
                if (!connections.has(key)) {
                    connections.set(key, []);
                }
                connections.get(key).push(wire.id);
            });
        });
        
        // 分析元件端點的連接
        this.simulator.components.forEach(comp => {
            Object.values(comp.terminals).forEach(terminal => {
                const key = `${terminal.x},${terminal.y}`;
                if (connections.has(key)) {
                    connections.get(key).push(`${comp.id}_terminal`);
                }
            });
        });
        
        return connections;
    }
    
    /**
     * 驗證導線完整性
     */
    validateWires() {
        const issues = [];
        
        this.simulator.wires.forEach(wire => {
            // 檢查導線是否有足夠的點
            if (wire.points.length < 2) {
                issues.push({
                    type: 'insufficient_points',
                    wireId: wire.id,
                    message: `導線 ${wire.id} 點數不足`
                });
            }
            
            // 檢查是否有重複點
            const pointSet = new Set();
            wire.points.forEach((point, index) => {
                const key = `${point.x},${point.y}`;
                if (pointSet.has(key)) {
                    issues.push({
                        type: 'duplicate_point',
                        wireId: wire.id,
                        pointIndex: index,
                        message: `導線 ${wire.id} 存在重複點`
                    });
                }
                pointSet.add(key);
            });
        });
        
        return issues;
    }
}
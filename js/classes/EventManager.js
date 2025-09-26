/**
 * 事件管理器
 * 負責處理所有滑鼠和鍵盤事件
 */
export class EventManager {
    constructor(simulator) {
        this.simulator = simulator;
        this.canvasManager = simulator.canvasManager;
        this.wireManager = simulator.wireManager;
    }
    
    /**
     * 初始化事件監聽器
     */
    init() {
        this.setupUIEvents();
        this.setupCanvasEvents();
        this.setupKeyboardEvents();
    }
    
    /**
     * 設置 UI 事件
     */
    setupUIEvents() {
        // 元件按鈕事件
        document.querySelectorAll('.component-btn[data-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.simulator.setMode('PLACING', { placingType: btn.dataset.type });
            });
        });
        
        // 工具按鈕事件
        document.getElementById('select-tool-btn').addEventListener('click', () => {
            this.simulator.setMode('SELECT');
        });
        
        document.getElementById('wire-tool-btn').addEventListener('click', () => {
            this.simulator.setMode('WIRING');
        });
        
        // 直流模擬按鈕事件
        document.getElementById('simulate-btn').addEventListener('click', () => {
            this.simulator.simulate();
        });

        // 【新增】 交流模擬按鈕事件
        document.getElementById('run-ac-btn').addEventListener('click', () => {
            const startFreq = parseFloat(document.getElementById('start-freq').value);
            const stopFreq = parseFloat(document.getElementById('stop-freq').value);
            const points = parseInt(document.getElementById('points-per-decade').value, 10);

            if (isNaN(startFreq) || isNaN(stopFreq) || isNaN(points) || startFreq <= 0 || stopFreq <= startFreq || points <= 0) {
                this.simulator.uiManager.showError('無效的交流分析參數');
                return;
            }
            
            this.simulator.runACAnalysis(startFreq, stopFreq, points);
        });
    }
    
    /**
     * 設置畫布事件
     */
    setupCanvasEvents() {
        const svg = this.simulator.svg;
        
        svg.addEventListener('mousedown', this.onMouseDown.bind(this));
        svg.addEventListener('mousemove', this.onMouseMove.bind(this));
        svg.addEventListener('mouseup', this.onMouseUp.bind(this));
        svg.addEventListener('wheel', this.onWheel.bind(this));
        svg.addEventListener('contextmenu', this.onContextMenu.bind(this));
        svg.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    }
    
    /**
     * 設置鍵盤事件
     */
    setupKeyboardEvents() {
        window.addEventListener('keydown', this.onKeyDown.bind(this));
    }
    
    /**
     * 滑鼠按下事件
     */
    onMouseDown(e) {
        if (e.button === 1) { // 中鍵平移
            this.startPanning(e);
            return;
        }
        
        if (e.button === 2) { // 右鍵
            e.preventDefault();
            this.handleRightClick(e);
            return;
        }
        
        if (e.button !== 0) return; // 只處理左鍵
        
        switch (this.simulator.mode) {
            case 'PLACING':
                this.handlePlacingClick(e);
                break;
            case 'WIRING':
                this.handleWiringClick(e);
                break;
            case 'SELECT':
                this.handleSelectClick(e);
                break;
        }
    }
    
    /**
     * 滑鼠移動事件
     */
    onMouseMove(e) {
        if (this.simulator.isMarqueeSelecting) {
            this.updateMarqueeSelection(e);
            return;
        }
        
        if (this.simulator.isPanning) {
            this.updatePanning(e);
            return;
        }
        
        if (this.simulator.isDragging) {
            this.updateDragging(e);
            return;
        }
        
        switch (this.simulator.mode) {
            case 'PLACING':
                this.updatePlacingPreview(e);
                break;
            case 'WIRING':
                this.updateWiringPreview(e);
                break;
        }
    }
    
    /**
     * 滑鼠放開事件
     */
    onMouseUp(e) {
        if (this.simulator.isMarqueeSelecting) {
            this.finishMarqueeSelection(e);
        }
        
        if (e.button === 1) { // 中鍵
            this.stopPanning();
        }
        
        if (this.simulator.isDragging) {
            this.finishDragging();
        }
    }
    
    /**
     * 滾輪事件（縮放）
     */
    onWheel(e) {
        e.preventDefault();
        
        const zoomIntensity = 0.1;
        const { x, y } = this.canvasManager.getSvgCoords(e);
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoom = Math.exp(wheel * zoomIntensity);
        
        this.simulator.viewBox.x -= (x - this.simulator.viewBox.x) * (zoom - 1);
        this.simulator.viewBox.y -= (y - this.simulator.viewBox.y) * (zoom - 1);
        this.simulator.viewBox.w *= zoom;
        this.simulator.viewBox.h *= zoom;
        
        this.canvasManager.updateViewBox();
    }
    
    /**
     * 右鍵選單事件
     */
    onContextMenu(e) {
        e.preventDefault();
        
        if (this.simulator.mode === 'PLACING') {
            this.simulator.ghostRotation = (this.simulator.ghostRotation + 90) % 360;
            this.updatePlacingPreview(e);
        } else if (this.simulator.mode === 'WIRING' && this.simulator.currentWirePoints.length > 0) {
            this.wireManager.finalizeCurrentWire();
            this.simulator.setMode('SELECT');
        }
    }
    
    /**
     * 滑鼠離開畫布事件
     */
    onMouseLeave() {
        if (this.simulator.isPanning) {
            this.stopPanning();
        }
        
        if (this.simulator.isDragging) {
            this.finishDragging();
        }
        
        if (this.simulator.isMarqueeSelecting) {
            this.simulator.isMarqueeSelecting = false;
            this.canvasManager.clearGhostElements();
            this.simulator.render();
        }
    }
    
    /**
     * 鍵盤事件
     */
    onKeyDown(e) {
        switch (e.key) {
            case 'Escape':
                this.handleEscape();
                break;
            case 'r':
            case 'R':
                this.handleRotation();
                break;
            case 'Delete':
            case 'Backspace':
                this.handleDelete();
                break;
        }
    }
    
    /**
     * 開始平移
     */
    startPanning(e) {
        this.simulator.isPanning = true;
        this.simulator.panStart = { x: e.clientX, y: e.clientY };
        this.simulator.svg.style.cursor = 'grabbing';
    }
    
    /**
     * 更新平移
     */
    updatePanning(e) {
        const dx = e.clientX - this.simulator.panStart.x;
        const dy = e.clientY - this.simulator.panStart.y;
        const zoomFactor = this.simulator.viewBox.w / this.simulator.svg.clientWidth;
        
        this.simulator.viewBox.x -= dx * zoomFactor;
        this.simulator.viewBox.y -= dy * zoomFactor;
        this.simulator.panStart = { x: e.clientX, y: e.clientY };
        
        this.canvasManager.updateViewBox();
    }
    
    /**
     * 停止平移
     */
    stopPanning() {
        this.simulator.isPanning = false;
        this.canvasManager.updateCursor();
    }
    
    /**
     * 處理右鍵點擊
     */
    handleRightClick(e) {
        if (this.simulator.mode === 'WIRING' && this.simulator.currentWirePoints.length > 0) {
            this.wireManager.finalizeCurrentWire();
            this.simulator.setMode('SELECT');
        }
    }
    
    /**
     * 處理放置模式點擊
     */
    handlePlacingClick(e) {
        const { x, y } = this.canvasManager.getSvgCoords(e);
        const snappedX = this.canvasManager.snapToGrid(x);
        const snappedY = this.canvasManager.snapToGrid(y);
        
        const newComp = this.simulator.addComponent(this.simulator.placingType, snappedX, snappedY);
        newComp.rotation = this.simulator.ghostRotation;
        newComp.updateTerminals();
        
        this.simulator.render();
        
        // 重新創建幽靈元件以便繼續放置
        this.canvasManager.createGhostComponent(this.simulator.placingType);
        this.updatePlacingPreview(e);
    }
    
    /**
     * 處理連線模式點擊
     */
    handleWiringClick(e) {
        const { snapPoint, connected } = this.wireManager.getWireSnapPoint(e);
        let newPoint;
        
        if (snapPoint.node) {
            newPoint = snapPoint.node.point;
        } else if (snapPoint.terminal) {
            newPoint = { x: snapPoint.x, y: snapPoint.y, terminal: snapPoint.terminal };
        } else if (snapPoint.wire) {
            newPoint = this.wireManager.createJunctionOnWire(snapPoint);
        } else {
            newPoint = { x: snapPoint.x, y: snapPoint.y, isNode: true };
        }
        
        if (!newPoint) return;
        
        const isFirstPoint = this.simulator.currentWirePoints.length === 0;
        this.simulator.currentWirePoints.push(newPoint);
        
        if (isFirstPoint) {
            this.canvasManager.createTempWire();
        }
        
        if (!isFirstPoint && (snapPoint.terminal || snapPoint.node)) {
            this.wireManager.finalizeCurrentWire();
            this.simulator.setMode('SELECT');
        } else {
            this.updateWiringPreview(e);
        }
    }
    
    /**
     * 處理選擇模式點擊
     */
    handleSelectClick(e) {
        const { x, y } = this.canvasManager.getSvgCoords(e);
        const clickedVertexHandle = e.target.closest('.wire-vertex-handle');
        const clickedComponent = e.target.closest('.component');
        const clickedWire = e.target.closest('.wire');
        
        let clickedComponentId = clickedComponent ? clickedComponent.dataset.id : null;
        let nodeKey = null;
        
        if (clickedVertexHandle) {
            const handleX = parseFloat(clickedVertexHandle.getAttribute('x')) + 
                          parseFloat(clickedVertexHandle.getAttribute('width')) / 2;
            const handleY = parseFloat(clickedVertexHandle.getAttribute('y')) + 
                          parseFloat(clickedVertexHandle.getAttribute('height')) / 2;
            nodeKey = `${handleX},${handleY}`;
        }
        
        const isComponentSelected = clickedComponentId && 
                                   this.simulator.selectedComponentIds.includes(clickedComponentId);
        const isNodeSelected = nodeKey && this.simulator.selectedNodeKeys.includes(nodeKey);
        
        if (isComponentSelected || isNodeSelected) {
            this.startDragging(e, x, y);
            return;
        }
        
        // 如果點在空白處，開始框選
        if (!clickedComponent && !clickedWire && !clickedVertexHandle) {
            this.startMarqueeSelection(e);
            return;
        }
        
        // 更新選擇
        this.updateSelection(e, clickedComponentId, nodeKey, clickedWire?.dataset.id);
    }
    
    /**
     * 開始拖曳
     */
    startDragging(e, x, y) {
        this.simulator.isDragging = true;
        this.simulator.dragStart = { x, y };
        
        // 記錄元件初始位置
        this.simulator.componentDragStartPositions.clear();
        this.simulator.selectedComponentIds.forEach(id => {
            const comp = this.simulator.getComponentById(id);
            if (comp) {
                this.simulator.componentDragStartPositions.set(id, { x: comp.x, y: comp.y });
            }
        });
        
        // 記錄節點初始位置
        this.simulator.draggingNodesInfo = [];
        this.simulator.selectedNodeKeys.forEach(key => {
            const [keyX, keyY] = key.split(',').map(parseFloat);
            this.simulator.wires.forEach(wire => {
                wire.points.forEach(point => {
                    if (point.x === keyX && point.y === keyY) {
                        this.simulator.draggingNodesInfo.push({
                            pointRef: point,
                            startX: point.x,
                            startY: point.y
                        });
                    }
                });
            });
        });
    }
    
    /**
     * 更新拖曳
     */
    updateDragging(e) {
        const { x, y } = this.canvasManager.getSvgCoords(e);
        const dx = x - this.simulator.dragStart.x;
        const dy = y - this.simulator.dragStart.y;
        
        // 移動選中的元件
        this.simulator.selectedComponentIds.forEach(id => {
            const comp = this.simulator.getComponentById(id);
            const startPos = this.simulator.componentDragStartPositions.get(id);
            if (comp && startPos) {
                comp.x = startPos.x + dx;
                comp.y = startPos.y + dy;
                comp.updateTerminals();
            }
        });
        
        // 移動選中的節點
        if (this.simulator.draggingNodesInfo) {
            this.simulator.draggingNodesInfo.forEach(info => {
                info.pointRef.x = info.startX + dx;
                info.pointRef.y = info.startY + dy;
            });
        }
        
        this.simulator.render();
    }
    
    /**
     * 完成拖曳
     */
    finishDragging() {
        this.simulator.isDragging = false;
        
        // 對齊網格
        this.simulator.selectedComponentIds.forEach(id => {
            const comp = this.simulator.getComponentById(id);
            if (comp) {
                comp.x = this.canvasManager.snapToGrid(comp.x);
                comp.y = this.canvasManager.snapToGrid(comp.y);
                comp.updateTerminals();
            }
        });
        
        if (this.simulator.draggingNodesInfo) {
            const finalNodeKeys = new Set();
            this.simulator.draggingNodesInfo.forEach(info => {
                info.pointRef.x = this.canvasManager.snapToGrid(info.pointRef.x);
                info.pointRef.y = this.canvasManager.snapToGrid(info.pointRef.y);
                finalNodeKeys.add(`${info.pointRef.x},${info.pointRef.y}`);
            });
            this.simulator.selectedNodeKeys = Array.from(finalNodeKeys);
        }
        
        this.simulator.draggingNodesInfo = null;
        this.simulator.render();
    }
    
    /**
     * 開始框選
     */
    startMarqueeSelection(e) {
        this.simulator.isMarqueeSelecting = true;
        this.simulator.marqueeStart = this.canvasManager.getSvgCoords(e);
        
        if (!e.shiftKey) {
            this.simulator.clearSelections();
        }
        
        this.simulator.render();
        this.canvasManager.createMarqueeRect();
    }
    
    /**
     * 更新框選
     */
    updateMarqueeSelection(e) {
        const currentPos = this.canvasManager.getSvgCoords(e);
        this.canvasManager.updateMarqueeRect(
            this.simulator.marqueeStart.x,
            this.simulator.marqueeStart.y,
            currentPos.x,
            currentPos.y
        );
    }
    
    /**
     * 完成框選
     */
    finishMarqueeSelection(e) {
        const finalPos = this.canvasManager.getSvgCoords(e);
        const sx = Math.min(this.simulator.marqueeStart.x, finalPos.x);
        const sy = Math.min(this.simulator.marqueeStart.y, finalPos.y);
        const sw = Math.abs(this.simulator.marqueeStart.x - finalPos.x);
        const sh = Math.abs(this.simulator.marqueeStart.y - finalPos.y);
        
        const selectedComponentIds = new Set(this.simulator.selectedComponentIds);
        const selectedWireIds = new Set(this.simulator.selectedWireIds);
        const selectedNodeKeys = new Set(this.simulator.selectedNodeKeys);
        
        // 選擇框內的元件
        this.simulator.components.forEach(comp => {
            if (comp.x >= sx && comp.x <= sx + sw && comp.y >= sy && comp.y <= sy + sh) {
                selectedComponentIds.add(comp.id);
            }
        });
        
        // 選擇框內的導線和節點
        this.simulator.wires.forEach(wire => {
            const isAnyPointInside = wire.points.some(p => 
                p.x >= sx && p.x <= sx + sw && p.y >= sy && p.y <= sy + sh
            );
            
            if (isAnyPointInside) {
                selectedWireIds.add(wire.id);
            }
            
            wire.points.forEach(p => {
                if (p.isNode && p.x >= sx && p.x <= sx + sw && p.y >= sy && p.y <= sy + sh) {
                    selectedNodeKeys.add(`${p.x},${p.y}`);
                }
            });
        });
        
        this.simulator.selectedComponentIds = Array.from(selectedComponentIds);
        this.simulator.selectedWireIds = Array.from(selectedWireIds);
        this.simulator.selectedNodeKeys = Array.from(selectedNodeKeys);
        
        this.simulator.isMarqueeSelecting = false;
        this.canvasManager.clearGhostElements();
        this.simulator.uiManager.updatePropertiesPanel();
        this.simulator.render();
    }
    
    /**
     * 更新選擇狀態
     */
    updateSelection(e, clickedComponentId, nodeKey, clickedWireId) {
        if (!e.shiftKey) {
            this.simulator.clearSelections();
        }
        
        // 切換元件選擇
        if (clickedComponentId) {
            const index = this.simulator.selectedComponentIds.indexOf(clickedComponentId);
            if (index > -1) {
                this.simulator.selectedComponentIds.splice(index, 1);
            } else {
                this.simulator.selectedComponentIds.push(clickedComponentId);
            }
        }
        
        // 切換節點選擇
        if (nodeKey) {
            const index = this.simulator.selectedNodeKeys.indexOf(nodeKey);
            if (index > -1) {
                this.simulator.selectedNodeKeys.splice(index, 1);
            } else {
                this.simulator.selectedNodeKeys.push(nodeKey);
            }
        }
        
        // 切換導線選擇
        if (clickedWireId) {
            const index = this.simulator.selectedWireIds.indexOf(clickedWireId);
            if (index > -1) {
                this.simulator.selectedWireIds.splice(index, 1);
            } else {
                this.simulator.selectedWireIds.push(clickedWireId);
            }
        }
        
        this.simulator.uiManager.updatePropertiesPanel();
        this.simulator.render();
    }
    
    /**
     * 更新放置預覽
     */
    updatePlacingPreview(e) {
        if (this.canvasManager.ghostComponent) {
            const { x, y } = this.canvasManager.getSvgCoords(e);
            this.canvasManager.updateGhostComponent(x, y, this.simulator.ghostRotation);
        }
    }
    
    /**
     * 更新連線預覽
     */
    updateWiringPreview(e) {
        if (this.canvasManager.tempWireEl && this.simulator.currentWirePoints.length > 0) {
            const { snapPoint } = this.wireManager.getWireSnapPoint(e);
            const previewPoints = [...this.simulator.currentWirePoints, snapPoint];
            this.canvasManager.updateTempWire(previewPoints);
        }
    }
    
    /**
     * 處理 Escape 鍵
     */
    handleEscape() {
        if (this.simulator.mode === 'WIRING' && this.simulator.currentWirePoints.length > 0) {
            this.wireManager.finalizeCurrentWire();
            this.simulator.setMode('SELECT');
        } else {
            this.simulator.setMode('SELECT');
        }
    }
    
    /**
     * 處理旋轉
     */
    handleRotation() {
        if (this.simulator.selectedComponentIds.length > 0) {
            this.simulator.selectedComponentIds.forEach(id => {
                const comp = this.simulator.getComponentById(id);
                if (comp) {
                    comp.rotate(90);
                }
            });
            this.simulator.render();
        }
    }
    
    /**
     * 處理刪除
     */
    handleDelete() {
        let anythingDeleted = false;
        
        // 刪除選中的節點
        if (this.simulator.selectedNodeKeys.length > 0) {
            const nodeKeysToDelete = new Set(this.simulator.selectedNodeKeys);
            this.simulator.wires.forEach(wire => {
                const originalLength = wire.points.length;
                wire.points = wire.points.filter(p => 
                    !(p.isNode && nodeKeysToDelete.has(`${p.x},${p.y}`))
                );
                if (wire.points.length !== originalLength) {
                    anythingDeleted = true;
                }
            });
            this.simulator.wires = this.simulator.wires.filter(wire => wire.points.length >= 2);
            this.simulator.selectedNodeKeys = [];
        }
        
        // 刪除選中的元件
        if (this.simulator.selectedComponentIds.length > 0) {
            this.simulator.selectedComponentIds.forEach(id => {
                this.simulator.removeComponent(id);
            });
            this.simulator.selectedComponentIds = [];
            anythingDeleted = true;
        }
        
        // 刪除選中的導線
        if (this.simulator.selectedWireIds.length > 0) {
            this.simulator.selectedWireIds.forEach(id => {
                this.simulator.removeWire(id);
            });
            this.simulator.selectedWireIds = [];
            anythingDeleted = true;
        }
        
        if (anythingDeleted) {
            this.simulator.uiManager.updatePropertiesPanel();
            this.simulator.render();
        }
    }
}
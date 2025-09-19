// 電路元件設計工具 - JavaScript 主程式
class ComponentDesigner {
    constructor() {
        this.gridSize = 20;
        this.currentTool = 'line'; // 暫時改為line來測試
        this.elements = [];
        this.terminals = [];
        this.selectedElement = null;
        this.isDrawing = false;
        this.startPoint = null;
        this.history = [];
        this.historyIndex = -1;
        this.showGrid = true;
        
        this.initializeCanvas();
        this.bindEvents();
        this.updateOutputs();
        this.updateToolStatus(); // 初始化工具狀態顯示
        
        console.log('ComponentDesigner 初始化完成，當前工具:', this.currentTool);
    }
    
    initializeCanvas() {
        this.canvas = document.getElementById('design-canvas');
        this.canvasWrapper = document.getElementById('canvas-wrapper');
        
        console.log('畫布初始化:', this.canvas, this.canvasWrapper); // 添加調試信息
        
        // 設置畫布大小
        this.resizeCanvas();
        
        // 添加畫布背景
        this.updateGridDisplay();
        
    }
    
    resizeCanvas() {
        const wrapper = this.canvasWrapper;
        const rect = wrapper.getBoundingClientRect();
        this.canvas.setAttribute('width', rect.width);
        this.canvas.setAttribute('height', rect.height);
    }
    
    bindEvents() {
        // 工具選擇
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
                console.log('工具切換到:', this.currentTool); // 添加調試信息
                this.cancelCurrentDrawing(); // 切換工具時取消當前繪圖
                this.updateToolStatus();
            });
        });
        
        // 畫布事件
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleRightClick.bind(this)); // 右鍵事件
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this)); // 滑鼠離開事件
        
        // 鍵盤事件
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // 輸出選項卡
        document.querySelectorAll('.output-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetTab = tab.dataset.tab;
                this.switchOutputTab(targetTab);
            });
        });
        
        // 表單變更
        const formInputs = [
            'component-name', 'component-type', 'component-category', 
            'component-description', 'default-value', 'unit', 
            'min-value', 'max-value'
        ];
        
        formInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => this.updateOutputs());
            }
        });
        
        // 視窗大小調整
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
        
        // 鍵盤事件
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    handleMouseDown(e) {
        // 防止右鍵觸發
        if (e.button !== 0) return; // 只處理左鍵
        
        const rect = this.canvas.getBoundingClientRect();
        const x = this.snapToGrid(e.clientX - rect.left);
        const y = this.snapToGrid(e.clientY - rect.top);
        
        this.startPoint = { x, y };
        
        if (this.currentTool === 'select') {
            this.handleSelectMode(x, y);
        } else {
            this.clearSelection();
            this.isDrawing = true;
            
            if (this.currentTool === 'terminal') {
                this.addTerminalAtPosition(x, y);
                this.isDrawing = false;
            } else if (this.currentTool === 'text') {
                this.addTextAtPosition(x, y);
                this.isDrawing = false;
            } else {
                this.startDrawing(x, y);
            }
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = this.snapToGrid(e.clientX - rect.left);
        const y = this.snapToGrid(e.clientY - rect.top);
        
        // 更新座標顯示
        const centerX = x - this.canvas.width.baseVal.value / 2;
        const centerY = y - this.canvas.height.baseVal.value / 2;
        document.getElementById('cursor-pos').textContent = `${centerX}, ${centerY}`;
        
        if (this.currentTool === 'select' && this.isDragging && this.selectedElement) {
            this.dragSelectedElement(x, y);
        } else if (this.isDrawing && this.currentTool !== 'terminal' && this.currentTool !== 'text' && this.currentTool !== 'select') {
            this.updateDrawingPreview(x, y);
        }
    }
    
    handleMouseUp(e) {
        // 只處理左鍵
        if (e.button !== 0) return;
        
        if (this.currentTool === 'select' && this.isDragging) {
            this.isDragging = false;
            this.updateSelectedElementData();
        } else if (this.isDrawing && this.currentTool !== 'terminal' && this.currentTool !== 'text' && this.currentTool !== 'select') {
            const rect = this.canvas.getBoundingClientRect();
            const x = this.snapToGrid(e.clientX - rect.left);
            const y = this.snapToGrid(e.clientY - rect.top);
            
            this.finishDrawing(x, y);
        }
        
        this.isDrawing = false;
        this.startPoint = null;
        this.removePreviewElement();
    }
    
    handleRightClick(e) {
        e.preventDefault(); // 阻止右鍵選單
        this.cancelCurrentDrawing();
        return false;
    }
    
    handleKeyDown(e) {
        // 刪除鍵
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedElement) {
                this.deleteSelectedElement();
                e.preventDefault();
            }
        }
        // ESC鍵取消當前操作
        else if (e.key === 'Escape') {
            this.cancelCurrentDrawing();
            this.clearSelection();
            e.preventDefault();
        }
    }
    
    handleMouseLeave(e) {
        // 滑鼠離開畫布時取消當前繪圖
        this.cancelCurrentDrawing();
    }
    
    handleKeyDown(e) {
        // ESC 鍵取消當前繪圖
        if (e.key === 'Escape') {
            this.cancelCurrentDrawing();
        }
        // Ctrl+Z 復原
        else if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
        }
        // Ctrl+Shift+Z 或 Ctrl+Y 重做
        else if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
            e.preventDefault();
            this.redo();
        }
    }
    
    cancelCurrentDrawing() {
        this.isDrawing = false;
        this.startPoint = null;
        this.removePreviewElement();
    }
    
    updateToolStatus() {
        const statusElement = document.getElementById('tool-status');
        const toolNames = {
            'select': '選擇工具',
            'line': '直線繪製 - 按住左鍵拖拽，右鍵取消',
            'rect': '矩形繪製 - 按住左鍵拖拽，右鍵取消',
            'circle': '圓形繪製 - 按住左鍵拖拽，右鍵取消',
            'ellipse': '橢圓繪製 - 按住左鍵拖拽，右鍵取消',
            'polygon': '多邊形繪製 - 按住左鍵拖拽，右鍵取消',
            'path': '路徑繪製 - 按住左鍵拖拽，右鍵取消',
            'text': '文字工具 - 點擊放置文字',
            'terminal': '端子工具 - 點擊放置端子'
        };
        
        if (statusElement) {
            statusElement.textContent = toolNames[this.currentTool] || '未知工具';
        }
    }
    
    snapToGrid(value) {
        return Math.round(value / this.gridSize) * this.gridSize;
    }
    
    startDrawing(x, y) {
        this.createPreviewElement(this.currentTool, x, y, x, y);
    }

    // 選取功能相關方法
    handleSelectMode(x, y) {
        const element = this.findElementAt(x, y);
        if (element) {
            this.selectElement(element);
            this.isDragging = true;
            this.dragOffset = {
                x: x - this.getElementCenterX(element),
                y: y - this.getElementCenterY(element)
            };
        } else {
            this.clearSelection();
        }
    }
    
    findElementAt(x, y) {
        // 從畫布中的SVG元素查找
        const elements = this.canvas.querySelectorAll('[data-type]');
        for (let element of elements) {
            if (this.isPointInElement(x, y, element)) {
                return element;
            }
        }
        return null;
    }
    
    isPointInElement(x, y, element) {
        const type = element.getAttribute('data-type');
        const tolerance = 10; // 點擊容差
        
        switch (type) {
            case 'line':
                const x1 = parseFloat(element.getAttribute('x1'));
                const y1 = parseFloat(element.getAttribute('y1'));
                const x2 = parseFloat(element.getAttribute('x2'));
                const y2 = parseFloat(element.getAttribute('y2'));
                return this.pointToLineDistance(x, y, x1, y1, x2, y2) <= tolerance;
                
            case 'rect':
                const rx = parseFloat(element.getAttribute('x'));
                const ry = parseFloat(element.getAttribute('y'));
                const rw = parseFloat(element.getAttribute('width'));
                const rh = parseFloat(element.getAttribute('height'));
                return x >= rx - tolerance && x <= rx + rw + tolerance && 
                       y >= ry - tolerance && y <= ry + rh + tolerance;
                       
            case 'circle':
                const cx = parseFloat(element.getAttribute('cx'));
                const cy = parseFloat(element.getAttribute('cy'));
                const r = parseFloat(element.getAttribute('r'));
                const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                return distance <= r + tolerance;
                
            case 'ellipse':
                const ecx = parseFloat(element.getAttribute('cx'));
                const ecy = parseFloat(element.getAttribute('cy'));
                const rx2 = parseFloat(element.getAttribute('rx'));
                const ry2 = parseFloat(element.getAttribute('ry'));
                const dx = (x - ecx) / rx2;
                const dy = (y - ecy) / ry2;
                return (dx * dx + dy * dy) <= 1.2; // 稍微放寬範圍
                
            default:
                return false;
        }
    }
    
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return Math.sqrt(A * A + B * B);
        
        const param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    selectElement(element) {
        this.clearSelection();
        this.selectedElement = element;
        this.selectedElementData = this.findElementDataByElement(element);
        
        // 高亮選中的元素
        element.style.filter = 'drop-shadow(0 0 8px #00ff00) brightness(1.2)';
        element.style.strokeWidth = '3';
        
        // 更新屬性面板
        this.updatePropertiesPanel();
    }
    
    clearSelection() {
        if (this.selectedElement) {
            // 移除高亮效果
            this.selectedElement.style.filter = '';
            this.selectedElement.style.strokeWidth = '';
            this.selectedElement = null;
            this.selectedElementData = null;
        }
        this.isDragging = false;
        this.updatePropertiesPanel();
    }
    
    findElementDataByElement(svgElement) {
        // 根據SVG元素找到對應的數據
        for (let i = 0; i < this.elements.length; i++) {
            // 比較元素屬性來匹配
            const data = this.elements[i];
            const testElement = this.dataToSVGElement(data);
            if (this.elementsEqual(svgElement, testElement)) {
                return { data, index: i };
            }
        }
        return null;
    }
    
    elementsEqual(el1, el2) {
        if (el1.tagName !== el2.tagName) return false;
        const type = el1.getAttribute('data-type');
        
        switch (type) {
            case 'line':
                return el1.getAttribute('x1') === el2.getAttribute('x1') &&
                       el1.getAttribute('y1') === el2.getAttribute('y1') &&
                       el1.getAttribute('x2') === el2.getAttribute('x2') &&
                       el1.getAttribute('y2') === el2.getAttribute('y2');
            case 'rect':
                return el1.getAttribute('x') === el2.getAttribute('x') &&
                       el1.getAttribute('y') === el2.getAttribute('y') &&
                       el1.getAttribute('width') === el2.getAttribute('width') &&
                       el1.getAttribute('height') === el2.getAttribute('height');
            case 'circle':
                return el1.getAttribute('cx') === el2.getAttribute('cx') &&
                       el1.getAttribute('cy') === el2.getAttribute('cy') &&
                       el1.getAttribute('r') === el2.getAttribute('r');
            default:
                return false;
        }
    }
    
    getElementCenterX(element) {
        const type = element.getAttribute('data-type');
        switch (type) {
            case 'line':
                const x1 = parseFloat(element.getAttribute('x1'));
                const x2 = parseFloat(element.getAttribute('x2'));
                return (x1 + x2) / 2;
            case 'rect':
                const x = parseFloat(element.getAttribute('x'));
                const w = parseFloat(element.getAttribute('width'));
                return x + w / 2;
            case 'circle':
            case 'ellipse':
                return parseFloat(element.getAttribute('cx'));
            default:
                return 0;
        }
    }
    
    getElementCenterY(element) {
        const type = element.getAttribute('data-type');
        switch (type) {
            case 'line':
                const y1 = parseFloat(element.getAttribute('y1'));
                const y2 = parseFloat(element.getAttribute('y2'));
                return (y1 + y2) / 2;
            case 'rect':
                const y = parseFloat(element.getAttribute('y'));
                const h = parseFloat(element.getAttribute('height'));
                return y + h / 2;
            case 'circle':
            case 'ellipse':
                return parseFloat(element.getAttribute('cy'));
            default:
                return 0;
        }
    }
    
    dragSelectedElement(x, y) {
        if (!this.selectedElement) return;
        
        const newX = x - this.dragOffset.x;
        const newY = y - this.dragOffset.y;
        
        this.moveElementTo(this.selectedElement, newX, newY);
    }
    
    moveElementTo(element, centerX, centerY) {
        const type = element.getAttribute('data-type');
        
        switch (type) {
            case 'line':
                const currentCenterX = this.getElementCenterX(element);
                const currentCenterY = this.getElementCenterY(element);
                const dx = centerX - currentCenterX;
                const dy = centerY - currentCenterY;
                
                const x1 = parseFloat(element.getAttribute('x1')) + dx;
                const y1 = parseFloat(element.getAttribute('y1')) + dy;
                const x2 = parseFloat(element.getAttribute('x2')) + dx;
                const y2 = parseFloat(element.getAttribute('y2')) + dy;
                
                element.setAttribute('x1', x1);
                element.setAttribute('y1', y1);
                element.setAttribute('x2', x2);
                element.setAttribute('y2', y2);
                break;
                
            case 'rect':
                const w = parseFloat(element.getAttribute('width'));
                const h = parseFloat(element.getAttribute('height'));
                element.setAttribute('x', centerX - w / 2);
                element.setAttribute('y', centerY - h / 2);
                break;
                
            case 'circle':
            case 'ellipse':
                element.setAttribute('cx', centerX);
                element.setAttribute('cy', centerY);
                break;
        }
    }
    
    updateSelectedElementData() {
        if (!this.selectedElement || !this.selectedElementData) return;
        
        // 更新數據陣列中的元素
        const newData = this.elementToData(this.selectedElement);
        this.elements[this.selectedElementData.index] = newData;
        this.selectedElementData.data = newData;
        
        // 更新輸出
        this.updateOutputs();
    }
    
    updatePropertiesPanel() {
        // 更新屬性面板顯示選中元素的信息
        // 這裡可以添加屬性編輯功能
    }
    
    // 添加刪除功能
    deleteSelectedElement() {
        if (!this.selectedElement || !this.selectedElementData) return;
        
        // 從畫布移除
        this.selectedElement.remove();
        
        // 從數據陣列移除
        this.elements.splice(this.selectedElementData.index, 1);
        
        // 清除選取
        this.selectedElement = null;
        this.selectedElementData = null;
        
        // 更新輸出
        this.updateOutputs();
    }
    
    updateDrawingPreview(x, y) {
        if (!this.startPoint) return;
        
        this.removePreviewElement();
        const previewElement = this.createPreviewElement(this.currentTool, this.startPoint.x, this.startPoint.y, x, y);
    }

    createPreviewElement(type, x1, y1, x2, y2) {
        // 移除之前的任何預覽
        this.removePreviewElement();
        
        // 如果起點和終點相同，創建一個小的可見元素
        if (x1 === x2 && y1 === y2) {
            const element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            element.setAttribute('cx', x1);
            element.setAttribute('cy', y1);
            element.setAttribute('r', '4');
            element.setAttribute('fill', '#ff6600');
            element.setAttribute('stroke', '#ffffff');
            element.setAttribute('stroke-width', '2');
            element.setAttribute('data-preview', 'true');
            element.style.pointerEvents = 'none';
            
            this.canvas.appendChild(element);
            return element;
        }
        
        const element = this.createElement(type, x1, y1, x2, y2);
        if (element) {
            // 設置預覽樣式
            element.setAttribute('opacity', '0.7');
            element.setAttribute('stroke-dasharray', '8,4');
            element.setAttribute('stroke', '#00ff00');
            element.setAttribute('stroke-width', '3');   
            element.setAttribute('fill', 'rgba(0, 255, 0, 0.1)');
            element.setAttribute('data-preview', 'true');
            element.style.pointerEvents = 'none';
            
            this.canvas.appendChild(element);
            return element;
        }
        return null;
    }
    
    removePreviewElement() {
        const preview = this.canvas.querySelector('[data-preview="true"]');
        if (preview) {
            preview.remove();
        }
    }
    
    finishDrawing(x, y) {
        if (!this.startPoint) return;
        
        this.removePreviewElement();
        
        const element = this.createElement(this.currentTool, this.startPoint.x, this.startPoint.y, x, y);
        if (element) {
            const elementData = this.elementToData(element);
            this.elements.push(elementData);
            this.canvas.appendChild(element);
            this.saveState();
            this.updateOutputs();
        }
    }
    
    createElement(type, x1, y1, x2, y2) {
        const centerX = this.canvas.width.baseVal.value / 2;
        const centerY = this.canvas.height.baseVal.value / 2;
        
        // 轉換為相對於中心的座標
        const relX1 = x1 - centerX;
        const relY1 = y1 - centerY;
        const relX2 = x2 - centerX;
        const relY2 = y2 - centerY;
        
        let element;
        
        switch (type) {
            case 'line':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                element.setAttribute('x1', x1);
                element.setAttribute('y1', y1);
                element.setAttribute('x2', x2);
                element.setAttribute('y2', y2);
                console.log('創建線條:', x1, y1, x2, y2);
                break;
                
            case 'rect':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                const width = Math.abs(x2 - x1);
                const height = Math.abs(y2 - y1);
                const x = Math.min(x1, x2);
                const y = Math.min(y1, y2);
                // 確保最小尺寸
                const finalWidth = Math.max(width, 1);
                const finalHeight = Math.max(height, 1);
                element.setAttribute('x', x);
                element.setAttribute('y', y);
                element.setAttribute('width', finalWidth);
                element.setAttribute('height', finalHeight);
                console.log('創建矩形:', x, y, finalWidth, finalHeight);
                break;
                
            case 'circle':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                const cx = (x1 + x2) / 2;
                const cy = (y1 + y2) / 2;
                const r = Math.max(Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 2, 1);
                element.setAttribute('cx', cx);
                element.setAttribute('cy', cy);
                element.setAttribute('r', r);
                console.log('創建圓形:', cx, cy, r);
                break;
                
            case 'ellipse':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                const ecx = (x1 + x2) / 2;
                const ecy = (y1 + y2) / 2;
                const rx = Math.max(Math.abs(x2 - x1) / 2, 1);
                const ry = Math.max(Math.abs(y2 - y1) / 2, 1);
                element.setAttribute('cx', ecx);
                element.setAttribute('cy', ecy);
                element.setAttribute('rx', rx);
                element.setAttribute('ry', ry);
                console.log('創建橢圓:', ecx, ecy, rx, ry);
                break;
                
            case 'polygon':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                // 創建簡單的三角形
                const midX = (x1 + x2) / 2;
                const points = `${midX},${y1} ${x1},${y2} ${x2},${y2}`;
                element.setAttribute('points', points);
                console.log('創建多邊形:', points);
                break;
                
            case 'path':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                // 創建簡單的弧形路徑
                const d = `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${y1 - Math.abs(y2 - y1)} ${x2} ${y2}`;
                element.setAttribute('d', d);
                console.log('創建路徑:', d);
                break;
                
            default:
                console.log('未知元素類型:', type);
                return null;
        }
        
        // 設置默認樣式
        element.setAttribute('fill', 'none');
        element.setAttribute('stroke', 'currentColor');
        element.setAttribute('stroke-width', '1');
        element.setAttribute('data-type', type);
        
        console.log('createElement 成功創建元素:', type, element);
        return element;
    }
    
    elementToData(element) {
        const type = element.getAttribute('data-type');
        const centerX = this.canvas.width.baseVal.value / 2;
        const centerY = this.canvas.height.baseVal.value / 2;
        
        const data = {
            id: `${type}_${Date.now()}`,
            type: type
        };
        
        switch (type) {
            case 'line':
                data.x1 = parseInt(element.getAttribute('x1')) - centerX;
                data.y1 = parseInt(element.getAttribute('y1')) - centerY;
                data.x2 = parseInt(element.getAttribute('x2')) - centerX;
                data.y2 = parseInt(element.getAttribute('y2')) - centerY;
                break;
                
            case 'rect':
                data.x = parseInt(element.getAttribute('x')) - centerX;
                data.y = parseInt(element.getAttribute('y')) - centerY;
                data.width = parseInt(element.getAttribute('width'));
                data.height = parseInt(element.getAttribute('height'));
                break;
                
            case 'circle':
                data.cx = parseInt(element.getAttribute('cx')) - centerX;
                data.cy = parseInt(element.getAttribute('cy')) - centerY;
                data.r = parseInt(element.getAttribute('r'));
                break;
                
            case 'ellipse':
                data.cx = parseInt(element.getAttribute('cx')) - centerX;
                data.cy = parseInt(element.getAttribute('cy')) - centerY;
                data.rx = parseInt(element.getAttribute('rx'));
                data.ry = parseInt(element.getAttribute('ry'));
                break;
                
            case 'polygon':
                data.points = element.getAttribute('points');
                break;
                
            case 'path':
                data.d = element.getAttribute('d');
                break;
                
            case 'text':
                data.x = parseInt(element.getAttribute('x')) - centerX;
                data.y = parseInt(element.getAttribute('y')) - centerY;
                data.text = element.textContent;
                data.fontSize = parseInt(element.getAttribute('font-size')) || 12;
                data.textAnchor = element.getAttribute('text-anchor') || 'middle';
                break;
        }
        
        data.stroke = element.getAttribute('stroke') || 'currentColor';
        data.strokeWidth = element.getAttribute('stroke-width') || '1';
        data.stroke = element.getAttribute('stroke') || 'currentColor';
        data.strokeWidth = element.getAttribute('stroke-width') || '1';
        data.fill = element.getAttribute('fill') || 'none';
        
        return data;
    }
    
    addTextAtPosition(x, y) {
        const text = prompt('請輸入文字:', 'R');
        if (text === null || text.trim() === '') return;
        
        const centerX = this.canvas.width.baseVal.value / 2;
        const centerY = this.canvas.height.baseVal.value / 2;
        
        const relX = x - centerX;
        const relY = y - centerY;
        
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', x);
        textElement.setAttribute('y', y);
        textElement.setAttribute('text-anchor', 'middle');
        textElement.setAttribute('font-size', '12');
        textElement.setAttribute('fill', 'currentColor');
        textElement.setAttribute('data-type', 'text');
        textElement.textContent = text;
        
        const elementData = {
            id: `text_${Date.now()}`,
            type: 'text',
            x: relX,
            y: relY,
            text: text,
            fontSize: 12,
            textAnchor: 'middle',
            fill: 'currentColor'
        };
        
        this.elements.push(elementData);
        this.canvas.appendChild(textElement);
        this.saveState();
        this.updateOutputs();
    }
    
    addTerminalAtPosition(x, y) {
        const centerX = this.canvas.width.baseVal.value / 2;
        const centerY = this.canvas.height.baseVal.value / 2;
        
        const relX = x - centerX;
        const relY = y - centerY;
        
        const terminalCount = this.terminals.length + 1;
        const terminal = {
            id: `terminal_${Date.now()}`,
            name: `t${terminalCount}`,
            displayName: `${terminalCount}`,
            x: relX,
            y: relY,
            direction: 'bidirectional',
            electricalType: 'signal'
        };
        
        this.terminals.push(terminal);
        this.renderTerminal(terminal, x, y);
        this.updateTerminalsList();
        this.saveState();
        this.updateOutputs();
    }
    
    renderTerminal(terminal, screenX, screenY) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', screenX);
        circle.setAttribute('cy', screenY);
        circle.setAttribute('r', '4');
        circle.setAttribute('class', 'terminal-point');
        circle.setAttribute('data-terminal-id', terminal.id);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', screenX + 8);
        text.setAttribute('y', screenY + 4);
        text.setAttribute('font-size', '12');
        text.setAttribute('fill', '#00e6e6');
        text.textContent = terminal.displayName;
        text.setAttribute('data-terminal-id', terminal.id);
        
        this.canvas.appendChild(circle);
        this.canvas.appendChild(text);
    }
    
    updateTerminalsList() {
        const list = document.getElementById('terminals-list');
        list.innerHTML = '';
        
        this.terminals.forEach((terminal, index) => {
            const item = document.createElement('div');
            item.className = 'terminal-item';
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${terminal.displayName} (${terminal.name})</span>
                    <button onclick="removeTerminal(${index})" style="background: #ff4444; border: none; color: white; padding: 2px 6px; border-radius: 2px; cursor: pointer;">×</button>
                </div>
                <div style="font-size: 10px; color: #999; margin-top: 4px;">
                    位置: (${terminal.x}, ${terminal.y}) | ${terminal.direction}
                </div>
            `;
            list.appendChild(item);
        });
    }
    
    updateGridDisplay() {
        if (this.showGrid) {
            this.canvasWrapper.style.backgroundImage = 
                'linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)';
            this.canvasWrapper.style.backgroundSize = `${this.gridSize}px ${this.gridSize}px`;
        } else {
            this.canvasWrapper.style.backgroundImage = 'none';
        }
    }
    
    switchOutputTab(tabName) {
        document.querySelectorAll('.output-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
        document.getElementById(`tab-${tabName}`).style.display = 'block';
        
        this.updateOutputs();
    }
    
    updateOutputs() {
        this.updatePreview();
        this.updateSVGOutput();
        this.updateJSONOutput();
        this.updateJSOutput();
    }
    
    updatePreview() {
        const previewSVG = document.getElementById('preview-svg');
        previewSVG.innerHTML = '';
        
        // 設置視窗框
        const viewBox = this.calculateViewBox();
        previewSVG.setAttribute('viewBox', viewBox);
        
        // 渲染元素
        this.elements.forEach(element => {
            const svgElement = this.dataToSVGElement(element);
            if (svgElement) {
                previewSVG.appendChild(svgElement);
            }
        });
        
        // 渲染端子
        this.terminals.forEach(terminal => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', terminal.x);
            circle.setAttribute('cy', terminal.y);
            circle.setAttribute('r', '3');
            circle.setAttribute('fill', '#00e6e6');
            circle.setAttribute('stroke', '#ffffff');
            circle.setAttribute('stroke-width', '1');
            previewSVG.appendChild(circle);
        });
    }
    
    calculateViewBox() {
        if (this.elements.length === 0 && this.terminals.length === 0) {
            return '-50 -50 100 100';
        }
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        // 計算元素邊界
        this.elements.forEach(element => {
            const bounds = this.getElementBounds(element);
            minX = Math.min(minX, bounds.minX);
            minY = Math.min(minY, bounds.minY);
            maxX = Math.max(maxX, bounds.maxX);
            maxY = Math.max(maxY, bounds.maxY);
        });
        
        // 計算端子邊界
        this.terminals.forEach(terminal => {
            minX = Math.min(minX, terminal.x - 5);
            minY = Math.min(minY, terminal.y - 5);
            maxX = Math.max(maxX, terminal.x + 5);
            maxY = Math.max(maxY, terminal.y + 5);
        });
        
        // 添加邊距
        const margin = 20;
        minX -= margin;
        minY -= margin;
        maxX += margin;
        maxY += margin;
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        return `${minX} ${minY} ${width} ${height}`;
    }
    
    getElementBounds(element) {
        let minX, minY, maxX, maxY;
        
        switch (element.type) {
            case 'line':
                minX = Math.min(element.x1, element.x2);
                minY = Math.min(element.y1, element.y2);
                maxX = Math.max(element.x1, element.x2);
                maxY = Math.max(element.y1, element.y2);
                break;
                
            case 'rect':
                minX = element.x;
                minY = element.y;
                maxX = element.x + element.width;
                maxY = element.y + element.height;
                break;
                
            case 'circle':
                minX = element.cx - element.r;
                minY = element.cy - element.r;
                maxX = element.cx + element.r;
                maxY = element.cy + element.r;
                break;
                
            case 'ellipse':
                minX = element.cx - element.rx;
                minY = element.cy - element.ry;
                maxX = element.cx + element.rx;
                maxY = element.cy + element.ry;
                break;
                
            case 'polygon':
                // 解析多邊形點並計算邊界
                const points = element.points.split(' ').map(point => {
                    const [x, y] = point.split(',').map(Number);
                    return { x, y };
                });
                if (points.length > 0) {
                    minX = Math.min(...points.map(p => p.x));
                    minY = Math.min(...points.map(p => p.y));
                    maxX = Math.max(...points.map(p => p.x));
                    maxY = Math.max(...points.map(p => p.y));
                } else {
                    minX = minY = maxX = maxY = 0;
                }
                break;
                
            case 'path':
                // 路徑邊界計算較複雜，這裡簡化為固定邊界
                minX = element.x - 20;
                minY = element.y - 20;
                maxX = element.x + 20;
                maxY = element.y + 20;
                break;
                
            case 'text':
                // 文字邊界估算
                const textWidth = (element.text || '').length * (element.fontSize || 12) * 0.6;
                const textHeight = element.fontSize || 12;
                minX = element.x - textWidth / 2;
                minY = element.y - textHeight / 2;
                maxX = element.x + textWidth / 2;
                maxY = element.y + textHeight / 2;
                break;
                
            default:
                minX = minY = maxX = maxY = 0;
        }
        
        return { minX, minY, maxX, maxY };
    }
    
    dataToSVGElement(data) {
        let element;
        
        switch (data.type) {
            case 'line':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                element.setAttribute('x1', data.x1);
                element.setAttribute('y1', data.y1);
                element.setAttribute('x2', data.x2);
                element.setAttribute('y2', data.y2);
                break;
                
            case 'rect':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                element.setAttribute('x', data.x);
                element.setAttribute('y', data.y);
                element.setAttribute('width', data.width);
                element.setAttribute('height', data.height);
                break;
                
            case 'circle':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                element.setAttribute('cx', data.cx);
                element.setAttribute('cy', data.cy);
                element.setAttribute('r', data.r);
                break;
                
            case 'ellipse':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                element.setAttribute('cx', data.cx);
                element.setAttribute('cy', data.cy);
                element.setAttribute('rx', data.rx);
                element.setAttribute('ry', data.ry);
                break;
                
            case 'polygon':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                element.setAttribute('points', data.points);
                break;
                
            case 'path':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                element.setAttribute('d', data.d);
                break;
                
            case 'text':
                element = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                element.setAttribute('x', data.x);
                element.setAttribute('y', data.y);
                element.setAttribute('text-anchor', data.textAnchor || 'middle');
                element.setAttribute('font-size', data.fontSize || 12);
                element.textContent = data.text;
                break;
                
            default:
                return null;
        }
        
        element.setAttribute('fill', data.fill || 'none');
        element.setAttribute('stroke', data.stroke || 'currentColor');
        element.setAttribute('stroke-width', data.strokeWidth || '1');
        
        return element;
    }
    
    updateSVGOutput() {
        const svgOutput = document.getElementById('svg-output');
        let svgString = '';
        
        // 生成SVG元素字符串
        this.elements.forEach(element => {
            svgString += this.elementToSVGString(element) + '\n';
        });
        
        // 生成端子註釋
        if (this.terminals.length > 0) {
            svgString += '\n<!-- 端子點 -->\n';
            this.terminals.forEach(terminal => {
                svgString += `<!-- ${terminal.name}: (${terminal.x}, ${terminal.y}) -->\n`;
            });
        }
        
        svgOutput.textContent = svgString.trim();
    }
    
    elementToSVGString(element) {
        switch (element.type) {
            case 'line':
                return `<line x1="\${${element.x1}}" y1="\${${element.y1}}" x2="\${${element.x2}}" y2="\${${element.y2}}" stroke="\${strokeColor}" stroke-width="\${strokeWidth}"></line>`;
                
            case 'rect':
                return `<rect x="\${${element.x}}" y="\${${element.y}}" width="\${${element.width}}" height="\${${element.height}}" fill="\${fillColor}" stroke="\${strokeColor}" stroke-width="\${strokeWidth}"></rect>`;
                
            case 'circle':
                return `<circle cx="\${${element.cx}}" cy="\${${element.cy}}" r="\${${element.r}}" fill="\${fillColor}" stroke="\${strokeColor}" stroke-width="\${strokeWidth}"></circle>`;
                
            case 'ellipse':
                return `<ellipse cx="\${${element.cx}}" cy="\${${element.cy}}" rx="\${${element.rx}}" ry="\${${element.ry}}" fill="\${fillColor}" stroke="\${strokeColor}" stroke-width="\${strokeWidth}"></ellipse>`;
                
            case 'polygon':
                return `<polygon points="${element.points}" fill="\${fillColor}" stroke="\${strokeColor}" stroke-width="\${strokeWidth}"></polygon>`;
                
            case 'path':
                return `<path d="${element.d}" fill="\${fillColor}" stroke="\${strokeColor}" stroke-width="\${strokeWidth}"></path>`;
                
            case 'text':
                return `<text x="\${${element.x}}" y="\${${element.y}}" text-anchor="${element.textAnchor || 'middle'}" font-size="${element.fontSize || 12}" fill="\${fillColor}">${element.text}</text>`;
                
            default:
                return '';
        }
    }
    
    updateJSONOutput() {
        const jsonOutput = document.getElementById('json-output');
        const componentData = this.generateComponentData();
        jsonOutput.textContent = JSON.stringify(componentData, null, 2);
    }
    
    updateJSOutput() {
        const jsOutput = document.getElementById('js-output');
        const jsCode = this.generateJavaScriptCode();
        jsOutput.textContent = jsCode;
    }
    
    generateComponentData() {
        const name = document.getElementById('component-name').value || '新元件';
        const type = document.getElementById('component-type').value || 'passive';
        const category = document.getElementById('component-category').value || 'custom';
        const description = document.getElementById('component-description').value || '';
        const defaultValue = document.getElementById('default-value').value || '';
        const unit = document.getElementById('unit').value || '';
        const minValue = document.getElementById('min-value').value;
        const maxValue = document.getElementById('max-value').value;
        
        // 計算邊界框
        const bounds = this.calculateBoundingBox();
        
        // 生成SVG模板
        let svgTemplate = '';
        this.elements.forEach(element => {
            svgTemplate += this.elementToSVGString(element);
        });
        
        const componentData = {
            metadata: {
                name: name,
                type: type,
                category: category,
                description: description,
                version: "1.0",
                author: "ComponentDesigner"
            },
            geometry: {
                gridSize: this.gridSize,
                boundingBox: {
                    width: Math.ceil(bounds.width / this.gridSize),
                    height: Math.ceil(bounds.height / this.gridSize)
                },
                centerPoint: { x: 0, y: 0 }
            },
            terminals: this.terminals.map(terminal => ({
                name: terminal.name,
                displayName: terminal.displayName,
                position: {
                    x: Math.round(terminal.x / this.gridSize),
                    y: Math.round(terminal.y / this.gridSize)
                },
                direction: terminal.direction,
                electricalType: terminal.electricalType
            })),
            svg: {
                template: svgTemplate,
                parameters: {
                    gridSize: this.gridSize
                },
                styles: {
                    strokeWidth: 1,
                    strokeColor: "currentColor",
                    fillColor: "none"
                }
            },
            properties: {}
        };
        
        if (defaultValue) {
            componentData.properties.defaultValue = isNaN(defaultValue) ? defaultValue : parseFloat(defaultValue);
        }
        if (unit) {
            componentData.properties.unit = unit;
        }
        if (minValue || maxValue) {
            componentData.properties.valueRange = {};
            if (minValue) componentData.properties.valueRange.min = parseFloat(minValue);
            if (maxValue) componentData.properties.valueRange.max = parseFloat(maxValue);
        }
        
        return componentData;
    }
    
    calculateBoundingBox() {
        if (this.elements.length === 0 && this.terminals.length === 0) {
            return { width: this.gridSize * 4, height: this.gridSize * 2 };
        }
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        // 計算所有元素和端子的邊界
        [...this.elements, ...this.terminals].forEach(item => {
            if (item.type) {
                // 元素
                const bounds = this.getElementBounds(item);
                minX = Math.min(minX, bounds.minX);
                minY = Math.min(minY, bounds.minY);
                maxX = Math.max(maxX, bounds.maxX);
                maxY = Math.max(maxY, bounds.maxY);
            } else {
                // 端子
                minX = Math.min(minX, item.x);
                minY = Math.min(minY, item.y);
                maxX = Math.max(maxX, item.x);
                maxY = Math.max(maxY, item.y);
            }
        });
        
        return {
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    generateJavaScriptCode() {
        const category = document.getElementById('component-category').value || 'CUSTOM';
        const componentName = category.toUpperCase();
        
        // 生成SVG定義
        let svgCode = '';
        this.elements.forEach(element => {
            svgCode += this.elementToSVGString(element);
        });
        
        // 生成端子定義
        const terminalDefinitions = this.terminals.map(terminal => 
            `        ${terminal.name}: { x: x + gridSize * ${Math.round(terminal.x / this.gridSize)}, y: y + gridSize * ${Math.round(terminal.y / this.gridSize)} }`
        ).join(',\n');
        
        // 生成旋轉邏輯
        const rotationLogic = this.terminals.map(terminal => {
            const relX = Math.round(terminal.x / this.gridSize);
            const relY = Math.round(terminal.y / this.gridSize);
            return `        const ${terminal.name}Pos = { x: gridSize * ${relX}, y: gridSize * ${relY} };
        component.terminals.${terminal.name}.x = component.x + (${terminal.name}Pos.x * cosA - ${terminal.name}Pos.y * sinA);
        component.terminals.${terminal.name}.y = component.y + (${terminal.name}Pos.x * sinA + ${terminal.name}Pos.y * cosA);`;
        }).join('\n');
        
        return `// 在 componentSVGs 物件中添加:
${componentName}: \`${svgCode}\`,

// 在 createComponentData 函數中添加:
if (type === '${componentName}') {
    componentData.terminals = {
${terminalDefinitions}
    };
}

// 在 updateComponentTerminals 函數中添加:
if (component.type === '${componentName}') {
${rotationLogic}
}`;
    }
    
    saveState() {
        const state = {
            elements: JSON.parse(JSON.stringify(this.elements)),
            terminals: JSON.parse(JSON.stringify(this.terminals))
        };
        
        // 清除後續歷史
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex++;
        
        // 限制歷史記錄數量
        if (this.history.length > 50) {
            this.history = this.history.slice(-50);
            this.historyIndex = this.history.length - 1;
        }
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadState(this.history[this.historyIndex]);
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadState(this.history[this.historyIndex]);
        }
    }
    
    loadState(state) {
        this.elements = JSON.parse(JSON.stringify(state.elements));
        this.terminals = JSON.parse(JSON.stringify(state.terminals));
        this.redrawCanvas();
        this.updateTerminalsList();
        this.updateOutputs();
    }
    
    redrawCanvas() {
        // 清除畫布
        const elements = this.canvas.querySelectorAll('*:not([data-preview])');
        elements.forEach(el => el.remove());
        
        // 重新繪製元素
        this.elements.forEach(element => {
            const svgElement = this.dataToSVGElement(element);
            if (svgElement) {
                // 轉換回螢幕座標
                const centerX = this.canvas.width.baseVal.value / 2;
                const centerY = this.canvas.height.baseVal.value / 2;
                
                this.adjustElementPosition(svgElement, element, centerX, centerY);
                this.canvas.appendChild(svgElement);
            }
        });
        
        // 重新繪製端子
        this.terminals.forEach(terminal => {
            const centerX = this.canvas.width.baseVal.value / 2;
            const centerY = this.canvas.height.baseVal.value / 2;
            this.renderTerminal(terminal, terminal.x + centerX, terminal.y + centerY);
        });
    }
    
    adjustElementPosition(svgElement, data, centerX, centerY) {
        switch (data.type) {
            case 'line':
                svgElement.setAttribute('x1', data.x1 + centerX);
                svgElement.setAttribute('y1', data.y1 + centerY);
                svgElement.setAttribute('x2', data.x2 + centerX);
                svgElement.setAttribute('y2', data.y2 + centerY);
                break;
                
            case 'rect':
                svgElement.setAttribute('x', data.x + centerX);
                svgElement.setAttribute('y', data.y + centerY);
                break;
                
            case 'circle':
                svgElement.setAttribute('cx', data.cx + centerX);
                svgElement.setAttribute('cy', data.cy + centerY);
                break;
                
            case 'ellipse':
                svgElement.setAttribute('cx', data.cx + centerX);
                svgElement.setAttribute('cy', data.cy + centerY);
                break;
                
            case 'polygon':
                // 多邊形需要調整所有點的位置
                const points = data.points.split(' ').map(point => {
                    const [x, y] = point.split(',').map(Number);
                    return `${x + centerX},${y + centerY}`;
                }).join(' ');
                svgElement.setAttribute('points', points);
                break;
                
            case 'path':
                // 路徑需要更複雜的處理，這裡簡化處理
                svgElement.setAttribute('d', data.d);
                break;
                
            case 'text':
                svgElement.setAttribute('x', data.x + centerX);
                svgElement.setAttribute('y', data.y + centerY);
                break;
        }
    }
}

// 全域函數
function clearCanvas() {
    if (confirm('確定要清除所有內容嗎？')) {
        designer.elements = [];
        designer.terminals = [];
        designer.redrawCanvas();
        designer.updateTerminalsList();
        designer.saveState();
        designer.updateOutputs();
    }
}

function toggleGrid() {
    designer.showGrid = !designer.showGrid;
    designer.updateGridDisplay();
}

function centerView() {
    // 實現置中檢視功能
    designer.redrawCanvas();
}

function undo() {
    designer.undo();
}

function redo() {
    designer.redo();
}

function addTerminal() {
    const centerX = designer.canvas.width.baseVal.value / 2;
    const centerY = designer.canvas.height.baseVal.value / 2;
    designer.addTerminalAtPosition(centerX, centerY);
}

function removeTerminal(index) {
    if (confirm('確定要刪除此端子嗎？')) {
        // 從畫布移除端子視覺元素
        const terminal = designer.terminals[index];
        const terminalElements = designer.canvas.querySelectorAll(`[data-terminal-id="${terminal.id}"]`);
        terminalElements.forEach(el => el.remove());
        
        // 從數據移除端子
        designer.terminals.splice(index, 1);
        designer.updateTerminalsList();
        designer.saveState();
        designer.updateOutputs();
    }
}

function exportComponent() {
    const componentData = designer.generateComponentData();
    const blob = new Blob([JSON.stringify(componentData, null, 2)], 
        {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${componentData.metadata.category}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function copySVG() {
    const svgOutput = document.getElementById('svg-output');
    navigator.clipboard.writeText(svgOutput.textContent);
    alert('SVG 代碼已複製到剪貼簿');
}

function copyJSON() {
    const jsonOutput = document.getElementById('json-output');
    navigator.clipboard.writeText(jsonOutput.textContent);
    alert('JSON 定義已複製到剪貼簿');
}

function copyJS() {
    const jsOutput = document.getElementById('js-output');
    navigator.clipboard.writeText(jsOutput.textContent);
    alert('JavaScript 代碼已複製到剪貼簿');
}

// 初始化設計工具
let designer;
document.addEventListener('DOMContentLoaded', () => {
    designer = new ComponentDesigner();
});
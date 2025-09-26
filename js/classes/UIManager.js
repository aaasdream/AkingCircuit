/**
 * UI 管理器
 * 負責管理使用者介面更新和屬性面板
 */
export class UIManager {
    constructor(simulator) {
        this.simulator = simulator;
        this.propertiesPanel = document.getElementById('properties-panel');
        this.noSelectionDiv = document.getElementById('no-selection');
    }
    
    /**
     * 初始化 UI
     */
    init() {
        this.updateButtonStates();
        this.updatePropertiesPanel();
    }
    
    /**
     * 更新按鈕的活躍狀態
     */
    updateButtonStates() {
        // 清除所有活躍狀態
        document.querySelectorAll('.component-btn.active').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 根據當前模式設置活躍按鈕
        switch (this.simulator.mode) {
            case 'SELECT':
                document.getElementById('select-tool-btn').classList.add('active');
                break;
            case 'WIRING':
                document.getElementById('wire-tool-btn').classList.add('active');
                break;
            case 'PLACING':
                const btn = document.querySelector(`.component-btn[data-type="${this.simulator.placingType}"]`);
                if (btn) {
                    btn.classList.add('active');
                }
                break;
        }
    }
    
    /**
     * 更新屬性面板
     */
    updatePropertiesPanel() {
        this.propertiesPanel.innerHTML = '';
        
        if (this.simulator.selectedComponentIds.length === 0) {
            this.showNoSelection();
        } else if (this.simulator.selectedComponentIds.length === 1) {
            this.showSingleComponentProperties();
        } else {
            this.showMultipleComponentsInfo();
        }
    }
    
    /**
     * 顯示未選擇狀態
     */
    showNoSelection() {
        this.propertiesPanel.appendChild(this.noSelectionDiv);
    }
    
    /**
     * 顯示單個元件的屬性
     */
    showSingleComponentProperties() {
        const componentId = this.simulator.selectedComponentIds[0];
        const component = this.simulator.getComponentById(componentId);
        
        if (!component) return;
        
        const propertiesHTML = `
            <div class="property-group">
                <label>ID:</label>
                <input type="text" value="${component.id}" readonly>
            </div>
            <div class="property-group">
                <label>類型:</label>
                <input type="text" value="${this.getComponentDisplayName(component.type)}" readonly>
            </div>
            <div class="property-group">
                <label>數值:</label>
                <input type="text" id="prop-value" value="${component.value}" placeholder="請輸入數值">
            </div>
            <div class="property-group">
                <label>位置:</label>
                <div class="position-inputs">
                    <input type="number" id="prop-x" value="${component.x}" placeholder="X">
                    <input type="number" id="prop-y" value="${component.y}" placeholder="Y">
                </div>
            </div>
            <div class="property-group">
                <label>旋轉:</label>
                <input type="number" id="prop-rotation" value="${component.rotation}" min="0" max="359" step="90" placeholder="角度">
            </div>
        `;
        
        this.propertiesPanel.innerHTML = propertiesHTML;
        
        // 綁定事件監聽器
        this.bindPropertyEvents(component);
    }
    
    /**
     * 顯示多個元件的信息
     */
    showMultipleComponentsInfo() {
        const count = this.simulator.selectedComponentIds.length;
        const infoHTML = `
            <div id="multi-selection-info">
                <p>已選取 ${count} 個元件</p>
                <div class="multi-selection-actions">
                    <button id="align-left-btn" class="action-btn">左對齊</button>
                    <button id="align-center-btn" class="action-btn">居中對齊</button>
                    <button id="align-right-btn" class="action-btn">右對齊</button>
                    <button id="distribute-horizontal-btn" class="action-btn">水平分布</button>
                </div>
            </div>
        `;
        
        this.propertiesPanel.innerHTML = infoHTML;
        
        // 綁定多選操作事件
        this.bindMultiSelectionEvents();
    }
    
    /**
     * 綁定單個元件的屬性事件
     */
    bindPropertyEvents(component) {
        // 數值變更事件
        const valueInput = document.getElementById('prop-value');
        if (valueInput) {
            valueInput.addEventListener('change', (e) => {
                const newValue = parseFloat(e.target.value);
                if (!isNaN(newValue)) {
                    component.value = newValue;
                    console.log(`Component ${component.id} value updated to ${newValue}`);
                }
            });
        }
        
        // 位置變更事件
        const xInput = document.getElementById('prop-x');
        const yInput = document.getElementById('prop-y');
        
        if (xInput && yInput) {
            const updatePosition = () => {
                const newX = parseFloat(xInput.value);
                const newY = parseFloat(yInput.value);
                
                if (!isNaN(newX) && !isNaN(newY)) {
                    component.setPosition(newX, newY);
                    this.simulator.render();
                }
            };
            
            xInput.addEventListener('change', updatePosition);
            yInput.addEventListener('change', updatePosition);
        }
        
        // 旋轉變更事件
        const rotationInput = document.getElementById('prop-rotation');
        if (rotationInput) {
            rotationInput.addEventListener('change', (e) => {
                const newRotation = parseFloat(e.target.value);
                if (!isNaN(newRotation)) {
                    component.rotation = newRotation % 360;
                    component.updateTerminals();
                    this.simulator.render();
                }
            });
        }
    }
    
    /**
     * 綁定多選操作事件
     */
    bindMultiSelectionEvents() {
        // 左對齊
        const alignLeftBtn = document.getElementById('align-left-btn');
        if (alignLeftBtn) {
            alignLeftBtn.addEventListener('click', () => {
                this.alignSelectedComponents('left');
            });
        }
        
        // 居中對齊
        const alignCenterBtn = document.getElementById('align-center-btn');
        if (alignCenterBtn) {
            alignCenterBtn.addEventListener('click', () => {
                this.alignSelectedComponents('center');
            });
        }
        
        // 右對齊
        const alignRightBtn = document.getElementById('align-right-btn');
        if (alignRightBtn) {
            alignRightBtn.addEventListener('click', () => {
                this.alignSelectedComponents('right');
            });
        }
        
        // 水平分布
        const distributeBtn = document.getElementById('distribute-horizontal-btn');
        if (distributeBtn) {
            distributeBtn.addEventListener('click', () => {
                this.distributeSelectedComponents('horizontal');
            });
        }
    }
    
    /**
     * 對齊選中的元件
     */
    alignSelectedComponents(alignment) {
        const selectedComponents = this.simulator.selectedComponentIds
            .map(id => this.simulator.getComponentById(id))
            .filter(comp => comp !== undefined);
        
        if (selectedComponents.length < 2) return;
        
        switch (alignment) {
            case 'left':
                const minX = Math.min(...selectedComponents.map(comp => comp.x));
                selectedComponents.forEach(comp => {
                    comp.setPosition(minX, comp.y);
                });
                break;
                
            case 'center':
                const avgX = selectedComponents.reduce((sum, comp) => sum + comp.x, 0) / selectedComponents.length;
                selectedComponents.forEach(comp => {
                    comp.setPosition(avgX, comp.y);
                });
                break;
                
            case 'right':
                const maxX = Math.max(...selectedComponents.map(comp => comp.x));
                selectedComponents.forEach(comp => {
                    comp.setPosition(maxX, comp.y);
                });
                break;
        }
        
        this.simulator.render();
    }
    
    /**
     * 分布選中的元件
     */
    distributeSelectedComponents(direction) {
        const selectedComponents = this.simulator.selectedComponentIds
            .map(id => this.simulator.getComponentById(id))
            .filter(comp => comp !== undefined);
        
        if (selectedComponents.length < 3) return;
        
        if (direction === 'horizontal') {
            // 按 X 座標排序
            selectedComponents.sort((a, b) => a.x - b.x);
            
            const leftMost = selectedComponents[0].x;
            const rightMost = selectedComponents[selectedComponents.length - 1].x;
            const spacing = (rightMost - leftMost) / (selectedComponents.length - 1);
            
            selectedComponents.forEach((comp, index) => {
                if (index > 0 && index < selectedComponents.length - 1) {
                    comp.setPosition(leftMost + spacing * index, comp.y);
                }
            });
        }
        
        this.simulator.render();
    }
    
    /**
     * 獲取元件類型的顯示名稱
     */
    getComponentDisplayName(type) {
        const displayNames = {
            'Resistor': '電阻',
            'Capacitor': '電容',
            'Inductor': '電感',
            'DC_Source': '直流電源'
        };
        return displayNames[type] || type;
    }
    
    /**
     * 顯示模擬結果
     */
    displaySimulationResults(results) {
        if (!results || !results.op || !results.op.voltages) {
            console.warn('No simulation results to display');
            return;
        }
        
        const voltages = results.op.voltages;
        
        // 創建結果顯示區域
        let resultsPanel = document.getElementById('simulation-results');
        if (!resultsPanel) {
            resultsPanel = document.createElement('div');
            resultsPanel.id = 'simulation-results';
            resultsPanel.className = 'simulation-results-panel';
            this.propertiesPanel.appendChild(resultsPanel);
        }
        
        let resultsHTML = '<h4>模擬結果</h4><div class="results-content">';
        
        // 顯示節點電壓
        Object.entries(voltages).forEach(([node, voltage]) => {
            resultsHTML += `<div class="result-item">
                <span class="node-name">${node}:</span>
                <span class="voltage-value">${voltage.toFixed(3)}V</span>
            </div>`;
        });
        
        resultsHTML += '</div>';
        resultsPanel.innerHTML = resultsHTML;
    }
    
    /**
     * 清除模擬結果顯示
     */
    clearSimulationResults() {
        const resultsPanel = document.getElementById('simulation-results');
        if (resultsPanel) {
            resultsPanel.remove();
        }
        
        // 清除 SVG 上的文字標籤
        document.querySelectorAll('.simulation-text').forEach(el => el.remove());
    }
    
    /**
     * 顯示錯誤訊息
     */
    showError(message, type = 'error') {
        // 創建或更新錯誤顯示區域
        let errorPanel = document.getElementById('error-panel');
        if (!errorPanel) {
            errorPanel = document.createElement('div');
            errorPanel.id = 'error-panel';
            errorPanel.className = `error-panel ${type}`;
            this.propertiesPanel.insertBefore(errorPanel, this.propertiesPanel.firstChild);
        }
        
        errorPanel.textContent = message;
        errorPanel.style.display = 'block';
        
        // 自動隱藏錯誤訊息
        setTimeout(() => {
            errorPanel.style.display = 'none';
        }, 5000);
    }
    
    /**
     * 隱藏錯誤訊息
     */
    hideError() {
        const errorPanel = document.getElementById('error-panel');
        if (errorPanel) {
            errorPanel.style.display = 'none';
        }
    }
}
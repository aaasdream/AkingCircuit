import { state, circuit } from './state.js';

const propertiesPanel = document.getElementById('properties-panel');
const noSelectionDiv = document.getElementById('no-selection');

// 更新按鈕的 활성화 狀態
export function updateButtonStates() {
    document.querySelectorAll('.component-btn.active').forEach(b => b.classList.remove('active'));
    const modeToAction = {
        'SELECT': () => document.getElementById('select-tool-btn').classList.add('active'),
        'WIRING': () => document.getElementById('wire-tool-btn').classList.add('active'),
        'PLACING': () => {
            const btn = document.querySelector(`.component-btn[data-type="${state.placingType}"]`);
            if (btn) btn.classList.add('active');
        }
    };
    if (modeToAction[state.mode]) {
        modeToAction[state.mode]();
    }
}

// 更新屬性面板
export function updatePropertiesPanel() {
    propertiesPanel.innerHTML = '';
    
    if (state.selectedComponentIds.length === 0) {
        propertiesPanel.appendChild(noSelectionDiv);
    } else if (state.selectedComponentIds.length === 1) {
        const component = circuit.components.find(c => c.id === state.selectedComponentIds[0]);
        if (component) {
            // 根據元件類型顯示不同的屬性
            if (component.type === 'NMOS' || component.type === 'PMOS') {
                propertiesPanel.innerHTML = `
                    <div><label>ID:</label> <input type="text" value="${component.id}" readonly></div>
                    <div><label>類型:</label> <input type="text" value="${component.type}" readonly></div>
                    <div><label>寬度 (W):</label> <input type="text" id="prop-width" value="${component.width || '10u'}" placeholder="10u"></div>
                    <div><label>長度 (L):</label> <input type="text" id="prop-length" value="${component.length || '1u'}" placeholder="1u"></div>
                    <div><label>模型:</label> <input type="text" id="prop-model" value="${component.model || (component.type === 'NMOS' ? 'NMOS_MODEL' : 'PMOS_MODEL')}" readonly></div>
                `;
                
                document.getElementById('prop-width').addEventListener('change', (e) => {
                    component.width = e.target.value || '10u';
                });
                
                document.getElementById('prop-length').addEventListener('change', (e) => {
                    component.length = e.target.value || '1u';
                });
            } else {
                propertiesPanel.innerHTML = `
                    <div><label>ID:</label> <input type="text" value="${component.id}" readonly></div>
                    <div><label>類型:</label> <input type="text" value="${component.type}" readonly></div>
                    <div><label>數值:</label> <input type="text" id="prop-value" value="${component.value}"></div>
                `;
                
                document.getElementById('prop-value').addEventListener('change', (e) => {
                    component.value = parseFloat(e.target.value) || 0;
                });
            }
        }
    } else {
        propertiesPanel.innerHTML = `<div id="no-selection">已選取 ${state.selectedComponentIds.length} 個元件</div>`;
    }
}
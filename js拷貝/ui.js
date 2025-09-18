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
            propertiesPanel.innerHTML = `
                <div><label>ID:</label> <input type="text" value="${component.id}" readonly></div>
                <div><label>類型:</label> <input type="text" value="${component.type}" readonly></div>
                <div><label>數值:</label> <input type="text" id="prop-value" value="${component.value}"></div>
            `;
            document.getElementById('prop-value').addEventListener('change', (e) => {
                component.value = parseFloat(e.target.value) || 0;
            });
        }
    } else {
        propertiesPanel.innerHTML = `<div id="no-selection">已選取 ${state.selectedComponentIds.length} 個元件</div>`;
    }
}
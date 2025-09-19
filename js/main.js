import { svg, state, gridSize } from './state.js';
import { createGridPattern, updateViewBox, render } from './canvas.js';
import { setupEventListeners } from './events.js';
import { updateButtonStates, updatePropertiesPanel } from './ui.js';

function init() {
    // 初始化視窗大小
    state.viewBox.w = svg.clientWidth;
    state.viewBox.h = svg.clientHeight;
    
    createGridPattern(gridSize);
    updateViewBox();
    
    // Initialize UI button listeners
    document.querySelectorAll('.component-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            if (type) {
                console.log(`Component button clicked: ${type}`);
                window.setMode('PLACING', { placingType: type });
            }
        });
    });
    
    document.getElementById('select-tool-btn').addEventListener('click', () => {
        window.setMode('SELECT');
    });
    
    document.getElementById('wire-tool-btn').addEventListener('click', () => {
        window.setMode('WIRING');
    });
    
    setupEventListeners();
    
    // 設置初始模式
    state.mode = 'IDLE'; // or 'SELECT'
    updateButtonStates();
    updatePropertiesPanel();
    
    // 初始渲染
    render();
    
    console.log("Circuit Simulator Initialized v1.1");
}

// 啟動應用程式
init();
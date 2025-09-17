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
    
    setupEventListeners();
    
    // 設置初始模式
    state.mode = 'SELECT';
    updateButtonStates();
    updatePropertiesPanel();
    
    // 初始渲染
    render();
    
    console.log("Circuit Simulator Initialized.");
}

// 啟動應用程式
init();
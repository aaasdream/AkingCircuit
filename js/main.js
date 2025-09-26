/**
 * 電路模擬器主程式
 * 使用物件導向架構重構
 */
import { CircuitSimulator } from './classes/CircuitSimulator.js';

// 全域模擬器實例
let simulator;

function init() {
    // 取得 SVG 元素
    const svgElement = document.getElementById('main-canvas');
    
    if (!svgElement) {
        console.error('Cannot find SVG element with id "main-canvas"');
        return;
    }
    
    try {
        // 創建並初始化模擬器
        simulator = new CircuitSimulator(svgElement);
        simulator.init();
        
        // 將模擬器實例設為全域變數以供除錯使用
        window.circuitSimulator = simulator;
        
        console.log("✅ Circuit Simulator Initialized with OOP Architecture.");
        console.log("Available classes:", {
            components: simulator.components.length,
            wires: simulator.wires.length,
            mode: simulator.mode
        });
        
    } catch (error) {
        console.error('❌ Failed to initialize Circuit Simulator:', error);
        alert('模擬器初始化失敗，請檢查控制台錯誤訊息');
    }
}

// 等待 DOM 載入完成後啟動應用程式
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// 導出模擬器實例以供其他模組使用
export { simulator };
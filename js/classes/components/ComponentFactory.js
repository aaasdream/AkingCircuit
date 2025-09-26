/**
 * 元件工廠類
 * 負責創建不同類型的電路元件
 */
import { Resistor } from './Resistor.js';
import { Capacitor } from './Capacitor.js';
import { Inductor } from './Inductor.js';
import { DCSource } from './DCSource.js';
import { ACSource } from './ACSource.js'; // 【新增】

export class ComponentFactory {
    constructor(simulator) {
        this.simulator = simulator;
    }
    
    /**
     * 創建元件
     */
    createComponent(type, x, y) {
        const id = this.simulator.getNextComponentId(type);
        
        switch (type) {
            case 'Resistor':
                return new Resistor(id, x, y);
            case 'Capacitor':
                return new Capacitor(id, x, y);
            case 'Inductor':
                return new Inductor(id, x, y);
            case 'DC_Source':
                return new DCSource(id, x, y);
            case 'AC_Source': // 【新增】
                return new ACSource(id, x, y); // 【新增】
            default:
                throw new Error(`Unknown component type: ${type}`);
        }
    }
    
    /**
     * 獲取元件 SVG 圖形
     */
    getComponentSVG(type) {
        // 直接返回靜態 SVG，避免創建臨時元件
        switch (type) {
            case 'Resistor':
                return new Resistor('temp', 0, 0).getSVG();
            case 'Capacitor':
                return new Capacitor('temp', 0, 0).getSVG();
            case 'Inductor':
                return new Inductor('temp', 0, 0).getSVG();
            case 'DC_Source':
                return new DCSource('temp', 0, 0).getSVG();
            case 'AC_Source': // 【新增】
                return new ACSource('temp', 0, 0).getSVG(); // 【新增】
            default:
                throw new Error(`Unknown component type: ${type}`);
        }
    }
}
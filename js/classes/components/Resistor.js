/**
 * 電阻元件類
 */
import { Component } from './Component.js';

export class Resistor extends Component {
    constructor(id, x, y, value = 1000) {
        super(id, 'Resistor', x, y, value);
    }
    
    /**
     * 獲取電阻的 SVG 圖形
     */
    getSVG() {
        const gridSize = 20;
        return `<line x1="${-gridSize*2}" y1="0" x2="${-gridSize}" y2="0"></line><rect x="${-gridSize}" y="${-gridSize/2}" width="${gridSize*2}" height="${gridSize}"></rect><line x1="${gridSize}" y1="0" x2="${gridSize*2}" y2="0"></line>`;
    }
    
    /**
     * 獲取電阻的網表行
     */
    getNetlistLine(node1, node2) {
        return `${this.id} ${node1} ${node2} ${this.value}`;
    }
}
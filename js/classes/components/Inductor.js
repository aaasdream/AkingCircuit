/**
 * 電感元件類
 */
import { Component } from './Component.js';

export class Inductor extends Component {
    constructor(id, x, y, value = 1e-3) {
        super(id, 'Inductor', x, y, value);
    }
    
    /**
     * 獲取電感的 SVG 圖形
     */
    getSVG() {
        const gridSize = 20;
        return `<line x1="${-gridSize*2}" y1="0" x2="${-gridSize*1.5}" y2="0"></line><path d="M ${-gridSize*1.5} 0 C ${-gridSize*1.5} ${-gridSize}, ${-gridSize*0.5} ${-gridSize}, ${-gridSize*0.5} 0"></path><path d="M ${-gridSize*0.5} 0 C ${-gridSize*0.5} ${-gridSize}, ${gridSize*0.5} ${-gridSize}, ${gridSize*0.5} 0"></path><path d="M ${gridSize*0.5} 0 C ${gridSize*0.5} ${-gridSize}, ${gridSize*1.5} ${-gridSize}, ${gridSize*1.5} 0"></path><line x1="${gridSize*1.5}" y1="0" x2="${gridSize*2}" y2="0"></line>`;
    }
    
    /**
     * 獲取電感的網表行
     */
    getNetlistLine(node1, node2) {
        return `${this.id} ${node1} ${node2} ${this.value}`;
    }
}
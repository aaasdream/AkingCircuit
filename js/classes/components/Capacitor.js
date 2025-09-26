/**
 * 電容元件類
 */
import { Component } from './Component.js';

export class Capacitor extends Component {
    constructor(id, x, y, value = 1e-6) {
        super(id, 'Capacitor', x, y, value);
    }
    
    /**
     * 獲取電容的 SVG 圖形
     */
    getSVG() {
        const gridSize = 20;
        return `<line x1="${-gridSize*2}" y1="0" x2="${-gridSize/2}" y2="0"></line><line x1="${-gridSize/2}" y1="${-gridSize}" x2="${-gridSize/2}" y2="${-gridSize}"></line><line x1="${-gridSize/2}" y1="${-gridSize}" x2="${-gridSize/2}" y2="${gridSize}"></line><line x1="${gridSize/2}" y1="${-gridSize}" x2="${gridSize/2}" y2="${gridSize}"></line><line x1="${gridSize/2}" y1="0" x2="${gridSize*2}" y2="0"></line>`;
    }
    
    /**
     * 獲取電容的網表行
     */
    getNetlistLine(node1, node2) {
        return `${this.id} ${node1} ${node2} ${this.value}`;
    }
}
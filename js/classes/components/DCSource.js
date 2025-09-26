/**
 * 直流電源元件類
 */
import { Component } from './Component.js';

export class DCSource extends Component {
    constructor(id, x, y, value = 12) {
        super(id, 'DC_Source', x, y, value);
    }
    
    /**
     * 獲取直流電源的 SVG 圖形
     */
    getSVG() {
        const gridSize = 20;
        return `<line x1="${-gridSize*2}" y1="0" x2="${-gridSize}" y2="0"></line><circle cx="0" cy="0" r="${gridSize}"></circle><line x1="${-gridSize/2}" y1="0" x2="${gridSize/2}" y2="0"></line><line x1="0" y1="${-gridSize/2}" x2="0" y2="${gridSize/2}"></line><line x1="${gridSize}" y1="0" x2="${gridSize*2}" y2="0"></line>`;
    }
    
    /**
     * 獲取直流電源的網表行
     */
    getNetlistLine(node1, node2) {
        return `${this.id} ${node2} ${node1} DC ${this.value}`;
    }
}
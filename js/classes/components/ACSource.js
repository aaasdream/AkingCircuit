/**
 * 交流電源元件類
 */
import { Component } from './Component.js';

export class ACSource extends Component {
    constructor(id, x, y, value = 1) { // 預設AC幅度為1V
        super(id, 'AC_Source', x, y, value);
        this.ac_phase = 0; // 可選的相位屬性
    }

    /**
     * 獲取交流電源的 SVG 圖形 (圓圈中帶有正弦波)
     */
    getSVG() {
        const gridSize = 20;
        return `
            <line x1="${-gridSize*2}" y1="0" x2="${-gridSize}" y2="0"></line>
            <circle cx="0" cy="0" r="${gridSize}"></circle>
            <path d="M ${-gridSize*0.7} 0 
                     Q ${-gridSize*0.35} ${-gridSize*0.7}, 0 0 
                     T ${gridSize*0.7} 0" 
                  stroke="${this.isSelected ? '#ffeb3b' : '#00e6e6'}" 
                  stroke-width="2" 
                  fill="none">
            </path>
            <line x1="${gridSize}" y1="0" x2="${gridSize*2}" y2="0"></line>
        `;
    }

    /**
     * 獲取交流電源的網表行
     */
    getNetlistLine(node1, node2) {
        // V(id) node+ node- AC (magnitude) (phase)
        return `${this.id} ${node2} ${node1} AC ${this.value} ${this.ac_phase}`;
    }
}
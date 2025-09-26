/**
 * 電路元件基類
 * 所有電路元件都繼承此類
 */
export class Component {
    constructor(id, type, x, y, value) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.value = value;
        this.rotation = 0;
        this.terminals = this.createTerminals();
    }
    
    /**
     * 創建元件端點 - 子類應該覆蓋此方法
     */
    createTerminals() {
        const gridSize = 20;
        return {
            t1: { x: this.x - gridSize * 2, y: this.y },
            t2: { x: this.x + gridSize * 2, y: this.y }
        };
    }
    
    /**
     * 更新端點位置（考慮旋轉）
     */
    updateTerminals() {
        const gridSize = 20;
        const angle = this.rotation * (Math.PI / 180);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const x1 = -gridSize * 2;
        const y1 = 0;
        const x2 = gridSize * 2;
        const y2 = 0;

        this.terminals.t1.x = this.x + (x1 * cosA - y1 * sinA);
        this.terminals.t1.y = this.y + (x1 * sinA + y1 * cosA);
        this.terminals.t2.x = this.x + (x2 * cosA - y2 * sinA);
        this.terminals.t2.y = this.y + (x2 * sinA + y2 * cosA);
    }
    
    /**
     * 旋轉元件
     */
    rotate(degrees = 90) {
        this.rotation = (this.rotation + degrees) % 360;
        this.updateTerminals();
    }
    
    /**
     * 設置位置
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.updateTerminals();
    }
    
    /**
     * 獲取 SVG 圖形定義 - 子類必須實現
     */
    getSVG() {
        throw new Error('getSVG method must be implemented by subclass');
    }
    
    /**
     * 獲取 SPICE 網表行 - 子類必須實現
     */
    getNetlistLine(node1, node2) {
        throw new Error('getNetlistLine method must be implemented by subclass');
    }
}
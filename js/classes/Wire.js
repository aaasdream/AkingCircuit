/**
 * 導線類
 * 代表電路中的連接線
 */
export class Wire {
    constructor(id, points = []) {
        this.id = id;
        this.points = points; // 導線路徑點陣列
    }
    
    /**
     * 添加點到導線
     */
    addPoint(point) {
        this.points.push(point);
    }
    
    /**
     * 移除指定點
     */
    removePoint(index) {
        if (index >= 0 && index < this.points.length) {
            this.points.splice(index, 1);
        }
    }
    
    /**
     * 獲取導線長度（點的數量）
     */
    getLength() {
        return this.points.length;
    }
    
    /**
     * 獲取導線起點
     */
    getStartPoint() {
        return this.points.length > 0 ? this.points[0] : null;
    }
    
    /**
     * 獲取導線終點
     */
    getEndPoint() {
        return this.points.length > 0 ? this.points[this.points.length - 1] : null;
    }
    
    /**
     * 檢查點是否在導線上
     */
    containsPoint(x, y) {
        return this.points.some(point => point.x === x && point.y === y);
    }
    
    /**
     * 複製導線
     */
    clone() {
        return new Wire(this.id, [...this.points.map(p => ({ ...p }))]);
    }
}
// 全域狀態管理
export const svg = document.getElementById('main-canvas');
export const svgNS = "http://www.w3.org/2000/svg";
export const gridSize = 20;

// 應用程式核心數據
export let circuit = {
    components: [],
    wires: [],
};

// 應用程式當前狀態
export let state = {
    mode: 'IDLE', // 'IDLE', 'PLACING', 'WIRING', 'SELECT'
    placingType: null,
    isPanning: false,
    isDragging: false, // 新增：是否正在拖曳元件
    panStart: { x: 0, y: 0 },
    dragStart: { x: 0, y: 0 }, // 新增：拖曳起始點
    ghostRotation: 0, // 新增：幽靈元件的旋轉角度
    componentDragStartPositions: new Map(), // 新增：儲存拖曳元件的初始位置
    viewBox: { x: 0, y: 0, w: 0, h: 0 },
    wireStartTerminal: null,
    selectedComponentIds: [], // 改為陣列以支援多選
};

// 用於產生元件唯一ID的計數器
export let elementCounter = { R: 0, C: 0, L: 0, V: 0 };

// 儲存最後一次生成網表時的節點，用於結果顯示
export let lastGeneratedNodes = {};
export function setLastGeneratedNodes(nodes) {
    lastGeneratedNodes = nodes;
}
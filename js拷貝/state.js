// 全域狀態管理
export const svg = document.getElementById('main-canvas');
export const svgNS = "http://www.w3.org/2000/svg";
export const gridSize = 20;

// 應用程式核心數據
export let circuit = {
    components: [],
    // Wire 數據結構升級：不再是 from/to，而是一個 points 陣列
    wires: [],
};

// 應用程式當前狀態
export let state = {
    mode: 'IDLE', // 'IDLE', 'PLACING', 'WIRING', 'SELECT'
    placingType: null,
    isPanning: false,
    isDragging: false, // 是否正在拖曳元件
    panStart: { x: 0, y: 0 },
    dragStart: { x: 0, y: 0 },
    ghostRotation: 0,
    componentDragStartPositions: new Map(),
    viewBox: { x: 0, y: 0, w: 0, h: 0 },
    // 移除 wireStartTerminal，改為追蹤當前路徑
    currentWirePoints: [], // 新增：正在繪製的線路點集
    selectedComponentIds: [],
    wireDirection: 'UNDETERMINED', // << 新增：用於決定佈線方向
};

// 用於產生元件唯一ID的計數器
export let elementCounter = { R: 0, C: 0, L: 0, V: 0 };

// 儲存最後一次生成網表時的節點，用於結果顯示
export let lastGeneratedNodes = {};
export function setLastGeneratedNodes(nodes) {
    lastGeneratedNodes = nodes;
}
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
    isDragging: false, 
    isMarqueeSelecting: false,
    panStart: { x: 0, y: 0 },
    dragStart: { x: 0, y: 0 },
    marqueeStart: { x: 0, y: 0 },
    ghostRotation: 0,
    componentDragStartPositions: new Map(),
    draggingNodesInfo: null,
    viewBox: { x: 0, y: 0, w: 0, h: 0 },
    currentWirePoints: [],
    selectedComponentIds: [],
    selectedWireIds: [],
    selectedNodeKeys: [],
    // draggingVertexInfo: null, // << 已刪除：移除此狀態以統一拖曳邏輯
    wireDirection: 'UNDETERMINED',
    wireLastMovePoint: null,
};

// 用於產生元件唯一ID的計數器
export let elementCounter = { R: 0, C: 0, L: 0, V: 0, W: 0 };

// 儲存最後一次生成網表時的節點，用於結果顯示
export let lastGeneratedNodes = {};
export function setLastGeneratedNodes(nodes) {
    lastGeneratedNodes = nodes;
}
import { gridSize, elementCounter } from './state.js';

// SVG 圖形定義
const componentSVGs = {
    Resistor: `<line x1="${-gridSize*2}" y1="0" x2="${-gridSize}" y2="0"></line><rect x="${-gridSize}" y="${-gridSize/2}" width="${gridSize*2}" height="${gridSize}"></rect><line x1="${gridSize}" y1="0" x2="${gridSize*2}" y2="0"></line>`,
    Capacitor: `<line x1="${-gridSize*2}" y1="0" x2="${-gridSize/2}" y2="0"></line><line x1="${-gridSize/2}" y1="${-gridSize}" x2="${-gridSize/2}" y2="${-gridSize}"></line><line x1="${-gridSize/2}" y1="${-gridSize}" x2="${-gridSize/2}" y2="${gridSize}"></line><line x1="${gridSize/2}" y1="${-gridSize}" x2="${gridSize/2}" y2="${gridSize}"></line><line x1="${gridSize/2}" y1="0" x2="${gridSize*2}" y2="0"></line>`,
    Inductor: `<line x1="${-gridSize*2}" y1="0" x2="${-gridSize*1.5}" y2="0"></line><path d="M ${-gridSize*1.5} 0 C ${-gridSize*1.5} ${-gridSize}, ${-gridSize*0.5} ${-gridSize}, ${-gridSize*0.5} 0"></path><path d="M ${-gridSize*0.5} 0 C ${-gridSize*0.5} ${-gridSize}, ${gridSize*0.5} ${-gridSize}, ${gridSize*0.5} 0"></path><path d="M ${gridSize*0.5} 0 C ${gridSize*0.5} ${-gridSize}, ${gridSize*1.5} ${-gridSize}, ${gridSize*1.5} 0"></path><line x1="${gridSize*1.5}" y1="0" x2="${gridSize*2}" y2="0"></line>`,
    DC_Source: `<line x1="${-gridSize*2}" y1="0" x2="${-gridSize}" y2="0"></line><circle cx="0" cy="0" r="${gridSize}"></circle><line x1="${-gridSize/2}" y1="0" x2="${gridSize/2}" y2="0"></line><line x1="0" y1="${-gridSize/2}" x2="0" y2="${gridSize/2}"></line><line x1="${gridSize}" y1="0" x2="${gridSize*2}" y2="0"></line>`
};
export const getComponentSVG = (type) => componentSVGs[type];

// 創建一個新的元件數據物件
export function createComponentData(type, x, y) {
    const shortType = { Resistor: 'R', Capacitor: 'C', Inductor: 'L', DC_Source: 'V' }[type];
    elementCounter[shortType]++;
    const id = `${shortType}${elementCounter[shortType]}`;
    
    const defaultValues = { R: 1000, C: 1e-6, L: 1e-3, V: 12 };

    const componentData = {
        id: id, type: type, value: defaultValues[shortType],
        x: x, y: y, rotation: 0,
        terminals: {
            t1: { x: x - gridSize * 2, y: y },
            t2: { x: x + gridSize * 2, y: y }
        }
    };
    return componentData;
}

// 根據旋轉角度更新元件的端點位置
export function updateComponentTerminals(component) {
    const angle = component.rotation * (Math.PI / 180); // 轉為弧度
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const x1 = -gridSize * 2; const y1 = 0;
    const x2 = gridSize * 2;  const y2 = 0;

    component.terminals.t1.x = component.x + (x1 * cosA - y1 * sinA);
    component.terminals.t1.y = component.y + (x1 * sinA + y1 * cosA);
    component.terminals.t2.x = component.x + (x2 * cosA - y2 * sinA);
    component.terminals.t2.y = component.y + (x2 * sinA + y2 * cosA);
}
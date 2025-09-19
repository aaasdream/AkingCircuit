import { gridSize, elementCounter } from './state.js';

// SVG 圖形定義
const componentSVGs = {
    Resistor: `<line x1="${-gridSize*2}" y1="0" x2="${-gridSize}" y2="0"></line><rect x="${-gridSize}" y="${-gridSize/2}" width="${gridSize*2}" height="${gridSize}"></rect><line x1="${gridSize}" y1="0" x2="${gridSize*2}" y2="0"></line>`,
    Capacitor: `<line x1="${-gridSize*2}" y1="0" x2="${-gridSize/2}" y2="0"></line><line x1="${-gridSize/2}" y1="${-gridSize}" x2="${-gridSize/2}" y2="${-gridSize}"></line><line x1="${-gridSize/2}" y1="${-gridSize}" x2="${-gridSize/2}" y2="${gridSize}"></line><line x1="${gridSize/2}" y1="${-gridSize}" x2="${gridSize/2}" y2="${gridSize}"></line><line x1="${gridSize/2}" y1="0" x2="${gridSize*2}" y2="0"></line>`,
    Inductor: `<line x1="${-gridSize*2}" y1="0" x2="${-gridSize*1.5}" y2="0"></line><path d="M ${-gridSize*1.5} 0 C ${-gridSize*1.5} ${-gridSize}, ${-gridSize*0.5} ${-gridSize}, ${-gridSize*0.5} 0"></path><path d="M ${-gridSize*0.5} 0 C ${-gridSize*0.5} ${-gridSize}, ${gridSize*0.5} ${-gridSize}, ${gridSize*0.5} 0"></path><path d="M ${gridSize*0.5} 0 C ${gridSize*0.5} ${-gridSize}, ${gridSize*1.5} ${-gridSize}, ${gridSize*1.5} 0"></path><line x1="${gridSize*1.5}" y1="0" x2="${gridSize*2}" y2="0"></line>`,
    DC_Source: `<line x1="${-gridSize*2}" y1="0" x2="${-gridSize}" y2="0"></line><circle cx="0" cy="0" r="${gridSize}"></circle><line x1="${-gridSize/2}" y1="0" x2="${gridSize/2}" y2="0"></line><line x1="0" y1="${-gridSize/2}" x2="0" y2="${gridSize/2}"></line><line x1="${gridSize}" y1="0" x2="${gridSize*2}" y2="0"></line>`,
    
    // N-Channel MOSFET (Enhancement mode with body diode)
    NMOS: `
        <!-- Drain terminal line -->
        <line x1="0" y1="${-gridSize*2}" x2="0" y2="${-gridSize}"></line>
        
        <!-- Source terminal line -->
        <line x1="0" y1="${gridSize}" x2="0" y2="${gridSize*2}"></line>
        
        <!-- Gate terminal line -->
        <line x1="${-gridSize*2}" y1="0" x2="${-gridSize*0.7}" y2="0"></line>
        
        <!-- Gate electrode (vertical line with gap) -->
        <line x1="${-gridSize*0.7}" y1="${-gridSize*0.8}" x2="${-gridSize*0.7}" y2="${gridSize*0.8}" stroke-width="2"></line>
        
        <!-- Channel region (vertical line) -->
        <line x1="${-gridSize*0.3}" y1="${-gridSize*0.8}" x2="${-gridSize*0.3}" y2="${gridSize*0.8}" stroke-width="3"></line>
        
        <!-- Drain connection to channel -->
        <line x1="${-gridSize*0.3}" y1="${-gridSize*0.8}" x2="0" y2="${-gridSize*0.8}"></line>
        <line x1="0" y1="${-gridSize}" x2="0" y2="${-gridSize*0.8}"></line>
        
        <!-- Source connection to channel -->
        <line x1="${-gridSize*0.3}" y1="${gridSize*0.8}" x2="0" y2="${gridSize*0.8}"></line>
        <line x1="0" y1="${gridSize}" x2="0" y2="${gridSize*0.8}"></line>
        
        <!-- Body diode (triangle pointing from source to drain) -->
        <polygon points="${gridSize*0.4},-${gridSize*0.15} ${gridSize*0.4},${gridSize*0.15} ${gridSize*0.65},0" fill="none" stroke="#00e6e6" stroke-width="2"></polygon>
        <line x1="${gridSize*0.65}" y1="${-gridSize*0.15}" x2="${gridSize*0.65}" y2="${gridSize*0.15}" stroke="#00e6e6" stroke-width="2"></line>
        
        <!-- Connection from channel to body diode -->
        <line x1="0" y1="0" x2="${gridSize*0.4}" y2="0"></line>
        
        <!-- Arrow indicating N-channel (pointing towards channel) -->
        <polygon points="${-gridSize*0.5},0 ${-gridSize*0.35},-${gridSize*0.08} ${-gridSize*0.35},${gridSize*0.08}" fill="#00e6e6"></polygon>
    `,
    
    // P-Channel MOSFET (Enhancement mode with body diode)
    PMOS: `
        <!-- Drain terminal line -->
        <line x1="0" y1="${-gridSize*2}" x2="0" y2="${-gridSize}"></line>
        
        <!-- Source terminal line -->
        <line x1="0" y1="${gridSize}" x2="0" y2="${gridSize*2}"></line>
        
        <!-- Gate terminal line -->
        <line x1="${-gridSize*2}" y1="0" x2="${-gridSize*0.9}" y2="0"></line>
        
        <!-- Gate electrode (vertical line with gap) -->
        <line x1="${-gridSize*0.7}" y1="${-gridSize*0.8}" x2="${-gridSize*0.7}" y2="${gridSize*0.8}" stroke-width="2"></line>
        
        <!-- Channel region (vertical line) -->
        <line x1="${-gridSize*0.3}" y1="${-gridSize*0.8}" x2="${-gridSize*0.3}" y2="${gridSize*0.8}" stroke-width="3"></line>
        
        <!-- Drain connection to channel -->
        <line x1="${-gridSize*0.3}" y1="${-gridSize*0.8}" x2="0" y2="${-gridSize*0.8}"></line>
        <line x1="0" y1="${-gridSize}" x2="0" y2="${-gridSize*0.8}"></line>
        
        <!-- Source connection to channel -->
        <line x1="${-gridSize*0.3}" y1="${gridSize*0.8}" x2="0" y2="${gridSize*0.8}"></line>
        <line x1="0" y1="${gridSize}" x2="0" y2="${gridSize*0.8}"></line>
        
        <!-- Body diode (triangle pointing from drain to source) -->
        <polygon points="${gridSize*0.65},-${gridSize*0.15} ${gridSize*0.65},${gridSize*0.15} ${gridSize*0.4},0" fill="none" stroke="#00e6e6" stroke-width="2"></polygon>
        <line x1="${gridSize*0.4}" y1="${-gridSize*0.15}" x2="${gridSize*0.4}" y2="${gridSize*0.15}" stroke="#00e6e6" stroke-width="2"></line>
        
        <!-- Connection from channel to body diode -->
        <line x1="0" y1="0" x2="${gridSize*0.4}" y2="0"></line>
        
        <!-- Circle indicating P-channel (bubble on gate) -->
        <circle cx="${-gridSize*0.8}" cy="0" r="${gridSize*0.1}" fill="none" stroke="#00e6e6" stroke-width="2"></circle>
    `
};
export const getComponentSVG = (type) => componentSVGs[type];

// 創建一個新的元件數據物件
export function createComponentData(type, x, y) {
    const shortType = { 
        Resistor: 'R', 
        Capacitor: 'C', 
        Inductor: 'L', 
        DC_Source: 'V',
        NMOS: 'M',
        PMOS: 'M'
    }[type];
    
    elementCounter[shortType] = elementCounter[shortType] || 0;
    elementCounter[shortType]++;
    const id = `${shortType}${elementCounter[shortType]}`;
    
    const defaultValues = { 
        R: 1000, 
        C: 1e-6, 
        L: 1e-3, 
        V: 12,
        M: 'IRF540' // 預設MOSFET型號
    };

    let componentData = {
        id: id, 
        type: type, 
        value: defaultValues[shortType],
        x: x, 
        y: y, 
        rotation: 0
    };

    // 根據元件類型設定不同的端子配置
    if (type === 'NMOS' || type === 'PMOS') {
        // MOSFET有三個端子：Gate, Drain, Source (根據SVG定義調整位置)
        componentData.terminals = {
            gate: { x: x - gridSize * 2, y: y },
            drain: { x: x, y: y - gridSize * 2 },
            source: { x: x, y: y + gridSize * 2 }
        };
    } else {
        // 其他元件使用傳統的兩端子結構
        componentData.terminals = {
            t1: { x: x - gridSize * 2, y: y },
            t2: { x: x + gridSize * 2, y: y }
        };
    }
    
    return componentData;
}

// 根據旋轉角度更新元件的端點位置
export function updateComponentTerminals(component) {
    const angle = component.rotation * (Math.PI / 180); // 轉為弧度
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    if (component.type === 'NMOS' || component.type === 'PMOS') {
        // MOSFET三端子的原始相對位置 (與SVG定義匹配)
        const gatePos = { x: -gridSize * 2, y: 0 };
        const drainPos = { x: 0, y: -gridSize * 2 };
        const sourcePos = { x: 0, y: gridSize * 2 };

        // 應用旋轉變換
        component.terminals.gate.x = component.x + (gatePos.x * cosA - gatePos.y * sinA);
        component.terminals.gate.y = component.y + (gatePos.x * sinA + gatePos.y * cosA);
        
        component.terminals.drain.x = component.x + (drainPos.x * cosA - drainPos.y * sinA);
        component.terminals.drain.y = component.y + (drainPos.x * sinA + drainPos.y * cosA);
        
        component.terminals.source.x = component.x + (sourcePos.x * cosA - sourcePos.y * sinA);
        component.terminals.source.y = component.y + (sourcePos.x * sinA + sourcePos.y * cosA);
    } else {
        // 其他元件的兩端子處理
        const x1 = -gridSize * 2; const y1 = 0;
        const x2 = gridSize * 2;  const y2 = 0;

        component.terminals.t1.x = component.x + (x1 * cosA - y1 * sinA);
        component.terminals.t1.y = component.y + (x1 * sinA + y1 * cosA);
        component.terminals.t2.x = component.x + (x2 * cosA - y2 * sinA);
        component.terminals.t2.y = component.y + (x2 * sinA + y2 * cosA);
    }
}
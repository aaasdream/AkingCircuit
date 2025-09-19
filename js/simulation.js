import { circuit, setLastGeneratedNodes, svg, svgNS } from './state.js';

// 使用 Disjoint Set Union (DSU) 演算法來高效地確定節點連接關係
class DSU {
    constructor() { this.parent = {}; }
    find(i) {
        if (this.parent[i] === undefined) this.parent[i] = i;
        if (this.parent[i] === i) return i;
        return this.parent[i] = this.find(this.parent[i]);
    }
    union(i, j) {
        const rootI = this.find(i);
        const rootJ = this.find(j);
        if (rootI !== rootJ) this.parent[rootI] = rootJ;
    }
}

export function generateNetlist() {
    const dsu = new DSU();
    let nodeCounter = 0;
    // 將每個端點視為一個獨立的節點
    circuit.components.forEach(comp => {
        Object.keys(comp.terminals).forEach(termId => {
            const key = `${comp.id}_${termId}`;
            dsu.find(key);
        });
    });
    // 遍歷所有線路，合併連接的節點
    circuit.wires.forEach(wire => {
        let connectedTerminals = [];
        // 檢查線路的首尾是否連接到端點
        const startPoint = wire.points[0];
        const endPoint = wire.points[wire.points.length - 1];
        if (startPoint.terminal) connectedTerminals.push(startPoint.terminal);
        if (endPoint.terminal) connectedTerminals.push(endPoint.terminal);
        // 將這條線路上所有連接的端點合併到同一個集合
        for (let i = 1; i < connectedTerminals.length; i++) {
            const key1 = `${connectedTerminals[0].componentId}_${connectedTerminals[0].terminalId}`;
            const key2 = `${connectedTerminals[i].componentId}_${connectedTerminals[i].terminalId}`;
            dsu.union(key1, key2);
        }
    });
    // 為每個集合的根分配一個節點名稱 (N1, N2...)
    const rootToNodeName = {};
    const terminalToNodeName = {};
    Object.keys(dsu.parent).forEach(terminalKey => {
        const root = dsu.find(terminalKey);
        if (!rootToNodeName[root]) {
            nodeCounter++;
            rootToNodeName[root] = `N${nodeCounter}`;
        }
        terminalToNodeName[terminalKey] = rootToNodeName[root];
    });
    // 接地處理邏輯
    let groundNodeName = null;
    const dcSource = circuit.components.find(c => c.type === 'DC_Source');
    if (dcSource) {
        groundNodeName = terminalToNodeName[`${dcSource.id}_t1`]; // 假設t1是負極
    }
    if (groundNodeName) {
         Object.keys(terminalToNodeName).forEach(key => {
            if (terminalToNodeName[key] === groundNodeName) {
                terminalToNodeName[key] = '0';
            }
        });
    }
    // 生成網表字串
    let netlist = "* Advanced Circuit Netlist\n\n";
    circuit.components.forEach(comp => {
        const node1 = terminalToNodeName[`${comp.id}_t1`] || `${comp.id}_t1_unconnected`;
        const node2 = terminalToNodeName[`${comp.id}_t2`] || `${comp.id}_t2_unconnected`;
        const node3 = terminalToNodeName[`${comp.id}_t3`] || `${comp.id}_t3_unconnected`;
        
        switch (comp.type) {
            case 'Resistor': 
                netlist += `${comp.id} ${node1} ${node2} ${comp.value}\n`; 
                break;
            case 'Capacitor': 
                netlist += `${comp.id} ${node1} ${node2} ${comp.value}\n`; 
                break;
            case 'Inductor': 
                netlist += `${comp.id} ${node1} ${node2} ${comp.value}\n`; 
                break;
            case 'DC_Source': 
                netlist += `${comp.id} ${node2} ${node1} DC ${comp.value}\n`; 
                break;
            case 'NMOS':
                // NMOS format: M<name> <drain> <gate> <source> <bulk> <model-name>
                netlist += `${comp.id} ${node1} ${node3} ${node2} ${node2} NMOS_MODEL\n`;
                break;
            case 'PMOS':
                // PMOS format: M<name> <drain> <gate> <source> <bulk> <model-name>
                netlist += `${comp.id} ${node1} ${node3} ${node2} ${node2} PMOS_MODEL\n`;
                break;
        }
    });
    
    // 添加MOSFET模型定義
    netlist += "\n";
    netlist += ".MODEL NMOS_MODEL NMOS (VTO=1.0 KP=120U LAMBDA=0.01)\n";
    netlist += ".MODEL PMOS_MODEL PMOS (VTO=-1.0 KP=40U LAMBDA=0.01)\n";
    netlist += "\n.OP\n.END\n";
    setLastGeneratedNodes(terminalToNodeName);
    return netlist;
}

export async function runSimulation() {
    const netlist = generateNetlist();
    console.log("--- Generated Netlist ---\n" + netlist);
    try {
        const results = await spicejs.simulate(netlist);
        console.log("--- Simulation Results ---", results);
        displayResults(results);
        alert("模擬成功！");
    } catch (error) {
        console.error("Simulation failed:", error);
        alert("模擬失敗，請檢查電路連接或在 Console (F12) 中查看錯誤。");
    }
}

function displayResults(results) {
    document.querySelectorAll('.simulation-text').forEach(el => el.remove());
    if (!results || !results.op || !results.op.voltages) return;
    const voltages = results.op.voltages;
    const displayedNodes = new Set();
    
    Object.keys(circuit.components).forEach(idx => {
        const comp = circuit.components[idx];
        const terminals = comp.type === 'NMOS' || comp.type === 'PMOS' ? ['t1', 't2', 't3'] : ['t1', 't2'];
        
        terminals.forEach(termId => {
            const nodeName = (comp.id && termId) ? (comp.id + '_' + termId) : null;
            const mappedNode = nodeName ? (results.lastGeneratedNodes ? results.lastGeneratedNodes[nodeName] : null) : null;
            if (mappedNode && voltages[mappedNode] !== undefined && !displayedNodes.has(mappedNode)) {
                displayedNodes.add(mappedNode);
                const voltageValue = voltages[mappedNode].toFixed(3) + 'V';
                const terminalPos = comp.terminals[termId];
                const text = document.createElementNS(svgNS, 'text');
                text.setAttribute('x', terminalPos.x);
                text.setAttribute('y', terminalPos.y - 10);
                text.classList.add('simulation-text');
                text.textContent = voltageValue;
                svg.appendChild(text);
            }
        });
    });
}
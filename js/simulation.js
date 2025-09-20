import { circuit, setLastGeneratedNodes, svg, svgNS, lastGeneratedNodes } from './state.js';

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

/**
 * 【已修改】生成更精確的 SPICE 網路表。
 * 這個版本將每個唯一的座標點視為一個潛在節點，並使用 DSU 演算法將
 * 所有透過導線物理連接的點（包括元件端點和導線轉折點）合併到同一個電氣節點中。
 * 這解決了導線之間 T 型連接無法被識別的問題。
 */
export function generateNetlist() {
    const dsu = new DSU();
    const pointToNodeKey = new Map();

    // 輔助函式：將座標物件轉換為唯一的字串鍵
    const getKeyForPoint = (p) => `${p.x},${p.y}`;

    // 步驟 1: 註冊電路中所有的連接點（元件端點和導線上的所有點）
    circuit.components.forEach(comp => {
        Object.values(comp.terminals).forEach(term => {
            dsu.find(getKeyForPoint(term));
        });
    });
    circuit.wires.forEach(wire => {
        wire.points.forEach(point => {
            dsu.find(getKeyForPoint(point));
        });
    });

    // 步驟 2: 根據導線連接關係，合併 DSU 集合
    // 這會將同一條導線上的所有點都歸入同一個電氣節點
    circuit.wires.forEach(wire => {
        for (let i = 0; i < wire.points.length - 1; i++) {
            const key1 = getKeyForPoint(wire.points[i]);
            const key2 = getKeyForPoint(wire.points[i + 1]);
            dsu.union(key1, key2);
        }
    });
    // 同時，將位置重疊的元件端點也進行合併
     circuit.components.forEach(comp => {
        Object.values(comp.terminals).forEach(term => {
             dsu.union(getKeyForPoint(term), getKeyForPoint(term));
        });
    });


    // 步驟 3: 為每個獨立的節點集合分配節點名稱 (例如 N1, N2, ...)
    const rootToNodeName = {};
    let nodeCounter = 0;
    const terminalToNodeName = {};

    Object.keys(dsu.parent).forEach(pointKey => {
        const root = dsu.find(pointKey);
        if (!rootToNodeName[root]) {
            nodeCounter++;
            rootToNodeName[root] = `N${nodeCounter}`;
        }
    });
    
    // 建立從元件端點ID到最終節點名稱的映射
     circuit.components.forEach(comp => {
        Object.keys(comp.terminals).forEach(termId => {
            const point = comp.terminals[termId];
            const root = dsu.find(getKeyForPoint(point));
            const terminalKey = `${comp.id}_${termId}`;
            terminalToNodeName[terminalKey] = rootToNodeName[root];
        });
    });


    // 步驟 4: 接地處理 - 將直流電源的負極 (t1) 所在的整個節點定義為 '0' (接地)
    let groundNodeName = null;
    const dcSource = circuit.components.find(c => c.type === 'DC_Source');
    if (dcSource) {
        groundNodeName = terminalToNodeName[`${dcSource.id}_t1`];
    }
    if (groundNodeName) {
         const groundRoot = dsu.find(getKeyForPoint(dcSource.terminals.t1));
         rootToNodeName[groundRoot] = '0'; // 將根節點直接命名為 '0'
         // 重新生成一次映射，確保所有接地端點都指向 '0'
         Object.keys(terminalToNodeName).forEach(key => {
            const [comp_id, term_id] = key.split('_');
            const component = circuit.components.find(c => c.id === comp_id);
            if(component){
                const point = component.terminals[term_id];
                const root = dsu.find(getKeyForPoint(point));
                terminalToNodeName[key] = rootToNodeName[root];
            }
        });
    }

    // 步驟 5: 生成最終的網路表字串
    let netlist = "* Advanced Wiring Netlist (Coordinate-based)\n\n";
    circuit.components.forEach(comp => {
        const node1 = terminalToNodeName[`${comp.id}_t1`] || `${comp.id}_t1_unconnected`;
        const node2 = terminalToNodeName[`${comp.id}_t2`] || `${comp.id}_t2_unconnected`;
        switch (comp.type) {
            case 'Resistor': netlist += `${comp.id} ${node1} ${node2} ${comp.value}\n`; break;
            case 'Capacitor': netlist += `${comp.id} ${node1} ${node2} ${comp.value}\n`; break;
            case 'Inductor': netlist += `${comp.id} ${node1} ${node2} ${comp.value}\n`; break;
            case 'DC_Source': netlist += `${comp.id} ${node2} ${node1} DC ${comp.value}\n`; break; // 電源方向：node2為正, node1為負
        }
    });
    netlist += "\n.OP\n.END\n";
    
    setLastGeneratedNodes(terminalToNodeName); // 保存映射以供顯示結果
    return netlist;
}

export async function runSimulation() {
    const netlist = generateNetlist();
    console.log("--- Generated Netlist ---\n" + netlist);
    try {
        const results = await spicejs.simulate(netlist);
        // 將節點映射附加到結果中，以便 displayResults 函式可以訪問
        results.lastGeneratedNodes = lastGeneratedNodes;
        console.log("--- Simulation Results ---", results);
        displayResults(results);
        alert("模擬成功！");
    } catch (error) {
        console.error("Simulation failed:", error);
        alert("模擬失敗，請檢查電路連接或在 Console (F12) 中查看錯誤。");
    }
}

function displayResults(results) {
    // 清除舊的模擬結果文字
    document.querySelectorAll('.simulation-text').forEach(el => el.remove());
    
    if (!results || !results.op || !results.op.voltages || !results.lastGeneratedNodes) return;
    
    const voltages = results.op.voltages;
    const nodes = results.lastGeneratedNodes;
    const displayedNodes = new Set();

    // 遍歷所有元件的端點
    circuit.components.forEach(comp => {
        Object.keys(comp.terminals).forEach(termId => {
            const terminalKey = `${comp.id}_${termId}`;
            const nodeName = nodes[terminalKey]; // 透過映射找到端點對應的節點名稱
            
            // 如果該節點存在電壓值，且尚未顯示過
            if (nodeName && voltages[nodeName] !== undefined && !displayedNodes.has(nodeName)) {
                displayedNodes.add(nodeName); // 標記為已顯示
                
                const voltageValue = voltages[nodeName].toFixed(3) + 'V';
                const terminalPos = comp.terminals[termId];
                
                // 在 SVG 上創建文字元素來顯示電壓
                const text = document.createElementNS(svgNS, 'text');
                text.setAttribute('x', terminalPos.x);
                text.setAttribute('y', terminalPos.y - 10); // 顯示在端點上方
                text.classList.add('simulation-text');
                text.textContent = voltageValue;
                svg.appendChild(text);
            }
        });
    });
}
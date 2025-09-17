import { circuit, lastGeneratedNodes, setLastGeneratedNodes, svg, svgNS } from './state.js';

// ... (這部分與前一版幾乎相同，只需微調以使用匯入的變數)
export function generateNetlist() {
    let netlist = "* Circuit Simulator Netlist\n\n";
    let nodes = {}; let nodeCounter = 0;

    circuit.wires.forEach(wire => {
        const fromComp = circuit.components.find(c => c.id === wire.from.componentId);
        const toComp = circuit.components.find(c => c.id === wire.to.componentId);
        if (!fromComp || !toComp) return;

        const keyFrom = `${wire.from.componentId}_${wire.from.terminalId}`;
        const keyTo = `${wire.to.componentId}_${wire.to.terminalId}`;
        const nodeFrom = nodes[keyFrom], nodeTo = nodes[keyTo];

        if (nodeFrom && nodeTo) {
            if (nodeFrom === nodeTo) return;
            Object.keys(nodes).forEach(k => { if (nodes[k] === nodeTo) nodes[k] = nodeFrom; });
        } else if (nodeFrom) { nodes[keyTo] = nodeFrom; }
        else if (nodeTo) { nodes[keyFrom] = nodeTo; }
        else {
            nodeCounter++; const newNode = `N${nodeCounter}`;
            nodes[keyFrom] = newNode; nodes[keyTo] = newNode;
        }
    });

    let groundNode = null;
    const dcSource = circuit.components.find(c => c.type === 'DC_Source');
    if (dcSource) { groundNode = nodes[`${dcSource.id}_t1`]; } // 假設電源第一個端點是負極

    if (groundNode) {
        Object.keys(nodes).forEach(k => { if (nodes[k] === groundNode) nodes[k] = '0'; });
    } else {
        const firstNodeName = Object.values(nodes)[0];
        if (firstNodeName) Object.keys(nodes).forEach(k => { if (nodes[k] === firstNodeName) nodes[k] = '0'; });
    }

    circuit.components.forEach(comp => {
        const node1 = nodes[`${comp.id}_t1`] || `${comp.id}_t1_unconnected`;
        const node2 = nodes[`${comp.id}_t2`] || `${comp.id}_t2_unconnected`;
        switch (comp.type) {
            case 'Resistor': netlist += `${comp.id} ${node1} ${node2} ${comp.value}\n`; break;
            case 'Capacitor': netlist += `${comp.id} ${node1} ${node2} ${comp.value}\n`; break;
            case 'Inductor': netlist += `${comp.id} ${node1} ${node2} ${comp.value}\n`; break;
            case 'DC_Source': netlist += `${comp.id} ${node2} ${node1} DC ${comp.value}\n`; break;
        }
    });

    netlist += "\n.OP\n.END\n";
    setLastGeneratedNodes(nodes);
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
    const displayedNodes = new Set(); // 確保每個節點只顯示一次電壓

    Object.keys(lastGeneratedNodes).forEach(terminalKey => {
        const nodeName = lastGeneratedNodes[terminalKey];
        if (voltages[nodeName] === undefined || displayedNodes.has(nodeName)) return;
        
        displayedNodes.add(nodeName);
        const voltageValue = voltages[nodeName].toFixed(3) + 'V';
        const [componentId, terminalId] = terminalKey.split('_');
        const component = circuit.components.find(c => c.id === componentId);
        
        if (component) {
            const terminalPos = component.terminals[terminalId];
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', terminalPos.x);
            text.setAttribute('y', terminalPos.y - 10);
            text.classList.add('simulation-text');
            text.textContent = voltageValue;
            svg.appendChild(text);
        }
    });
}
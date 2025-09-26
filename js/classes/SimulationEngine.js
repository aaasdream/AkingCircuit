/**
 * 模擬引擎類
 * 負責處理 SPICE 網表生成和模擬執行
 */

/**
 * 使用 Disjoint Set Union (DSU) 演算法來高效地確定節點連接關係
 */
class DSU {
    constructor() {
        this.parent = {};
    }
    
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

export class SimulationEngine {
    constructor(simulator) {
        this.simulator = simulator;
        this.lastGeneratedNodes = {};
        this.simulationResults = null;
    }
    
    /**
     * 執行模擬
     */
    async runSimulation() {
        try {
            // 驗證電路
            const validation = this.validateCircuit();
            if (!validation.isValid) {
                this.simulator.uiManager.showError(validation.message);
                return;
            }
            
            // 生成網表
            const netlist = this.generateNetlist();
            console.log("--- Generated Netlist ---\n" + netlist);
            
            // 執行 SPICE 模擬
            const results = await spicejs.simulate(netlist);
            
            // 保存結果
            this.simulationResults = results;
            results.lastGeneratedNodes = this.lastGeneratedNodes;
            
            console.log("--- Simulation Results ---", results);
            
            // 顯示結果
            this.displayResults(results);
            this.simulator.uiManager.displaySimulationResults(results);
            
            alert("模擬成功！");
            
        } catch (error) {
            console.error("Simulation failed:", error);
            this.simulator.uiManager.showError(`模擬失敗: ${error.message}`);
            alert("模擬失敗，請檢查電路連接或在 Console (F12) 中查看錯誤。");
        }
    }
    
    /**
     * 驗證電路有效性
     */
    validateCircuit(isAC = false) { // 【修改】增加 isAC 參數
        // 檢查是否有元件
        if (this.simulator.components.length === 0) {
            return {
                isValid: false,
                message: "電路中沒有任何元件"
            };
        }
        
        // 檢查是否有電源
        const source_type = isAC ? 'AC_Source' : 'DC_Source';
        const hasPowerSource = this.simulator.components.some(comp => comp.type === source_type);
        
        if (!hasPowerSource) {
            return {
                isValid: false,
                message: `電路中沒有${isAC ? '交流' : '直流'}電源元件`
            };
        }
        
        // 檢查元件值是否有效
        for (const comp of this.simulator.components) {
            if (comp.value <= 0 || isNaN(comp.value)) {
                return {
                    isValid: false,
                    message: `元件 ${comp.id} 的數值無效 (${comp.value})`
                };
            }
        }
        
        // 檢查連接性
        const connectivity = this.analyzeConnectivity();
        if (!connectivity.isConnected) {
            return {
                isValid: false,
                message: "電路存在未連接的元件"
            };
        }
        
        return {
            isValid: true,
            message: "電路驗證通過"
        };
    }
    
    /**
     * 分析電路連接性
     */
    analyzeConnectivity() {
        // 簡化的連接性檢查
        // 檢查每個元件是否至少有一個端點被連接
        
        const connectedPoints = new Set();
        
        // 收集所有導線上的點
        this.simulator.wires.forEach(wire => {
            wire.points.forEach(point => {
                connectedPoints.add(`${point.x},${point.y}`);
            });
        });
        
        // 檢查元件端點是否被連接
        let unconnectedComponents = 0;
        
        for (const comp of this.simulator.components) {
            const terminal1Connected = connectedPoints.has(`${comp.terminals.t1.x},${comp.terminals.t1.y}`);
            const terminal2Connected = connectedPoints.has(`${comp.terminals.t2.x},${comp.terminals.t2.y}`);
            
            if (!terminal1Connected && !terminal2Connected) {
                unconnectedComponents++;
            }
        }
        
        return {
            isConnected: unconnectedComponents === 0,
            unconnectedComponents: unconnectedComponents
        };
    }
    
    /**
     * 生成 SPICE 網表
     */
    generateNetlist() {
        const dsu = new DSU();
        const pointToNodeKey = new Map();
        
        // 輔助函式：將座標物件轉換為唯一的字串鍵
        const getKeyForPoint = (p) => `${p.x},${p.y}`;
        
        // 步驟 1: 註冊電路中所有的連接點
        this.simulator.components.forEach(comp => {
            Object.values(comp.terminals).forEach(term => {
                dsu.find(getKeyForPoint(term));
            });
        });
        
        this.simulator.wires.forEach(wire => {
            wire.points.forEach(point => {
                dsu.find(getKeyForPoint(point));
            });
        });
        
        // 步驟 2: 根據導線連接關係，合併 DSU 集合
        this.simulator.wires.forEach(wire => {
            for (let i = 0; i < wire.points.length - 1; i++) {
                const key1 = getKeyForPoint(wire.points[i]);
                const key2 = getKeyForPoint(wire.points[i + 1]);
                dsu.union(key1, key2);
            }
        });
        
        // 合併位置重疊的元件端點
        this.simulator.components.forEach(comp => {
            Object.values(comp.terminals).forEach(term => {
                dsu.union(getKeyForPoint(term), getKeyForPoint(term));
            });
        });
        
        // 步驟 3: 為每個獨立的節點集合分配節點名稱
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
        
        // 建立從元件端點到節點名稱的映射
        this.simulator.components.forEach(comp => {
            Object.keys(comp.terminals).forEach(termId => {
                const point = comp.terminals[termId];
                const root = dsu.find(getKeyForPoint(point));
                const terminalKey = `${comp.id}_${termId}`;
                terminalToNodeName[terminalKey] = rootToNodeName[root];
            });
        });
        
        // 步驟 4: 接地處理
        let groundNodeName = null;
        const dcSource = this.simulator.components.find(c => c.type === 'DC_Source');
        
        if (dcSource) {
            groundNodeName = terminalToNodeName[`${dcSource.id}_t1`];
        }
        
        if (groundNodeName) {
            const groundRoot = dsu.find(getKeyForPoint(dcSource.terminals.t1));
            rootToNodeName[groundRoot] = '0';
            
            // 重新生成映射
            Object.keys(terminalToNodeName).forEach(key => {
                const [comp_id, term_id] = key.split('_');
                const component = this.simulator.getComponentById(comp_id);
                if (component) {
                    const point = component.terminals[term_id];
                    const root = dsu.find(getKeyForPoint(point));
                    terminalToNodeName[key] = rootToNodeName[root];
                }
            });
        }
        
        // 步驟 5: 生成最終的網路表字串
        let netlist = "* Advanced Circuit Simulator Netlist\n";
        netlist += `* Generated on ${new Date().toISOString()}\n\n`;
        
        this.simulator.components.forEach(comp => {
            const node1 = terminalToNodeName[`${comp.id}_t1`] || `${comp.id}_t1_unconnected`;
            const node2 = terminalToNodeName[`${comp.id}_t2`] || `${comp.id}_t2_unconnected`;
            
            netlist += comp.getNetlistLine(node1, node2) + '\n';
        });
        
        netlist += "\n.OP\n.END\n";
        
        // 保存節點映射
        this.lastGeneratedNodes = terminalToNodeName;
        
        return netlist;
    }
    
    /**
     * 顯示模擬結果在 SVG 上
     */
    displayResults(results) {
        // 清除舊的模擬結果文字
        document.querySelectorAll('.simulation-text').forEach(el => el.remove());
        
        if (!results || !results.op || !results.op.voltages || !results.lastGeneratedNodes) {
            return;
        }
        
        const voltages = results.op.voltages;
        const nodes = results.lastGeneratedNodes;
        const displayedNodes = new Set();
        
        // 在 SVG 上顯示節點電壓
        this.simulator.components.forEach(comp => {
            Object.keys(comp.terminals).forEach(termId => {
                const terminalKey = `${comp.id}_${termId}`;
                const nodeName = nodes[terminalKey];
                
                if (nodeName && voltages[nodeName] !== undefined && !displayedNodes.has(nodeName)) {
                    displayedNodes.add(nodeName);
                    
                    const voltageValue = voltages[nodeName].toFixed(3) + 'V';
                    const terminalPos = comp.terminals[termId];
                    
                    // 創建電壓標籤
                    const text = document.createElementNS(this.simulator.svgNS, 'text');
                    text.setAttribute('x', terminalPos.x);
                    text.setAttribute('y', terminalPos.y - 10);
                    text.classList.add('simulation-text');
                    text.textContent = voltageValue;
                    text.style.fontSize = '12px';
                    text.style.fill = '#FF6B6B';
                    text.style.fontWeight = 'bold';
                    text.style.textAnchor = 'middle';
                    
                    this.simulator.svg.appendChild(text);
                }
            });
        });
    }
    
    /**
     * 清除模擬結果顯示
     */
    clearResults() {
        document.querySelectorAll('.simulation-text').forEach(el => el.remove());
        this.simulator.uiManager.clearSimulationResults();
        this.simulationResults = null;
    }
    
    /**
     * 導出網表到文件
     */
    exportNetlist() {
        try {
            const netlist = this.generateNetlist();
            
            // 創建並下載文件
            const blob = new Blob([netlist], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'circuit_netlist.cir';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('Export failed:', error);
            this.simulator.uiManager.showError('網表導出失敗');
        }
    }
    
    /**
     * 獲取模擬統計信息
     */
    getSimulationStats() {
        if (!this.simulationResults) {
            return null;
        }
        
        const stats = {
            nodeCount: Object.keys(this.lastGeneratedNodes).length,
            componentCount: this.simulator.components.length,
            wireCount: this.simulator.wires.length,
            hasResults: !!this.simulationResults.op,
            simulationTime: this.simulationResults.time || 0
        };
        
        return stats;
    }
    
    /**
     * 進行頻率分析
     */
    async runFrequencyAnalysis(startFreq = 1, stopFreq = 1e6, points = 100) {
        try {
            // 【修改】 驗證AC電路
            const validation = this.validateCircuit(true);
            if (!validation.isValid) {
                this.simulator.uiManager.showError(validation.message);
                return;
            }
            
            let netlist = this.generateNetlist();
            
            // 替換 .OP 為 .AC 分析
            netlist = netlist.replace('.OP', `.AC DEC ${points} ${startFreq} ${stopFreq}`);
            
            console.log("--- AC Analysis Netlist ---\n" + netlist);
            
            const results = await spicejs.simulate(netlist);
            console.log("--- AC Analysis Results ---", results);
            
            // 【新增】 呼叫 UI 管理器顯示結果
            this.simulator.uiManager.displayACResults(results);
            alert("交流分析成功！詳細數據請在 Console (F12) 查看。");
            
            return results;
            
        } catch (error) {
            console.error("AC Analysis failed:", error);
            this.simulator.uiManager.showError(`頻率分析失敗: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 進行暫態分析（如果支援）
     */
    async runTransientAnalysis(stopTime = 1e-3, stepTime = 1e-6) {
        try {
            const validation = this.validateCircuit();
            if (!validation.isValid) {
                throw new Error(validation.message);
            }
            
            let netlist = this.generateNetlist();
            
            // 替換 .OP 為 .TRAN 分析
            netlist = netlist.replace('.OP', `.TRAN ${stepTime} ${stopTime}`);
            
            console.log("--- Transient Analysis Netlist ---\n" + netlist);
            
            const results = await spicejs.simulate(netlist);
            console.log("--- Transient Analysis Results ---", results);
            
            return results;
            
        } catch (error) {
            console.error("Transient Analysis failed:", error);
            this.simulator.uiManager.showError(`暫態分析失敗: ${error.message}`);
            throw error;
        }
    }
}
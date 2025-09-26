/**
 * 電路模擬器主類別
 * 負責協調各個子系統並管理整體應用程式狀態
 */
import { CanvasManager } from './CanvasManager.js';
import { EventManager } from './EventManager.js';
import { UIManager } from './UIManager.js';
import { WireManager } from './WireManager.js';
import { SimulationEngine } from './SimulationEngine.js';
import { ComponentFactory } from './components/ComponentFactory.js';

export class CircuitSimulator {
    constructor(svgElement) {
        // 基本設置
        this.svg = svgElement;
        this.gridSize = 20;
        this.svgNS = "http://www.w3.org/2000/svg";
        
        // 電路數據
        this.components = [];
        this.wires = [];
        
        // 應用程式狀態
        this.mode = 'SELECT'; // 'IDLE', 'PLACING', 'WIRING', 'SELECT'
        this.placingType = null;
        this.ghostRotation = 0;
        
        // 視窗和平移狀態
        this.viewBox = { x: 0, y: 0, w: 0, h: 0 };
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        
        // 選擇狀態
        this.selectedComponentIds = [];
        this.selectedWireIds = [];
        this.selectedNodeKeys = [];
        
        // 拖曳狀態
        this.isDragging = false;
        this.isMarqueeSelecting = false;
        this.dragStart = { x: 0, y: 0 };
        this.marqueeStart = { x: 0, y: 0 };
        this.componentDragStartPositions = new Map();
        this.draggingNodesInfo = null;
        
        // 連線狀態
        this.currentWirePoints = [];
        
        // ID 計數器
        this.elementCounter = { R: 0, C: 0, L: 0, V: 0, W: 0 };
        
        // 初始化子系統
        this.initializeSubsystems();
    }
    
    /**
     * 初始化各個子系統
     */
    initializeSubsystems() {
        // 初始化時需要按順序，因為有相互依賴
        this.componentFactory = new ComponentFactory(this);
        this.canvasManager = new CanvasManager(this);
        this.wireManager = new WireManager(this);
        this.simulationEngine = new SimulationEngine(this);
        this.uiManager = new UIManager(this);
        this.eventManager = new EventManager(this);
    }
    
    /**
     * 初始化應用程式
     */
    init() {
        // 初始化視窗大小
        this.viewBox.w = this.svg.clientWidth;
        this.viewBox.h = this.svg.clientHeight;
        
        // 初始化子系統
        this.canvasManager.init();
        this.uiManager.init();
        this.eventManager.init();
        
        // 設置初始模式
        this.setMode('SELECT');
        
        // 初始渲染
        this.render();
        
        console.log("Circuit Simulator Initialized.");
    }
    
    /**
     * 設置應用程式模式
     */
    setMode(newMode, options = {}) {
        this.canvasManager.clearGhostElements();
        
        this.mode = newMode;
        this.placingType = options.placingType || null;
        this.clearSelections();
        this.ghostRotation = 0;
        this.currentWirePoints = [];
        
        if (this.mode === 'PLACING' && this.placingType) {
            this.canvasManager.createGhostComponent(this.placingType);
        }
        
        this.canvasManager.updateCursor();
        this.uiManager.updateButtonStates();
        this.uiManager.updatePropertiesPanel();
    }
    
    /**
     * 清除所有選擇
     */
    clearSelections() {
        this.selectedComponentIds = [];
        this.selectedWireIds = [];
        this.selectedNodeKeys = [];
    }
    
    /**
     * 主渲染函數
     */
    render() {
        this.canvasManager.render();
    }
    
    /**
     * 添加元件到電路
     */
    addComponent(type, x, y) {
        const component = this.componentFactory.createComponent(type, x, y);
        this.components.push(component);
        return component;
    }
    
    /**
     * 移除元件
     */
    removeComponent(componentId) {
        this.components = this.components.filter(comp => comp.id !== componentId);
    }
    
    /**
     * 根據ID獲取元件
     */
    getComponentById(id) {
        return this.components.find(comp => comp.id === id);
    }
    
    /**
     * 添加導線
     */
    addWire(points) {
        const wire = this.wireManager.createWire(points);
        this.wires.push(wire);
        return wire;
    }
    
    /**
     * 移除導線
     */
    removeWire(wireId) {
        this.wires = this.wires.filter(wire => wire.id !== wireId);
    }
    
    /**
     * 根據ID獲取導線
     */
    getWireById(id) {
        return this.wires.find(wire => wire.id === id);
    }
    
    /**
     * 執行直流模擬
     */
    simulate() {
        this.simulationEngine.runSimulation();
    }
    
    /**
     * 【新增】 執行交流模擬
     */
    runACAnalysis(startFreq, stopFreq, points) {
        this.simulationEngine.runFrequencyAnalysis(startFreq, stopFreq, points);
    }
    
    /**
     * 獲取下一個元件ID
     */
    getNextComponentId(type) {
        // 【修改】 添加 AC_Source 支持
        const shortType = { Resistor: 'R', Capacitor: 'C', Inductor: 'L', DC_Source: 'V', AC_Source: 'V' }[type];
        this.elementCounter[shortType]++;
        return `${shortType}${this.elementCounter[shortType]}`;
    }
    
    /**
     * 獲取下一個導線ID
     */
    getNextWireId() {
        this.elementCounter.W++;
        return `w${this.elementCounter.W}`;
    }
}
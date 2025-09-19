/**
 * WireDataModel.js - Core data model for wire representation
 * 
 * This module implements a data structure for representing wires and connections
 * that can be part of a central data model. It provides methods for creating,
 * querying, and manipulating wires.
 */

/**
 * @class WireDataModel
 * @description Manages a collection of wires in a circuit
 */
export class WireDataModel {
    /**
     * Create a new WireDataModel
     */
    constructor() {
        this.wires = [];
        this.nextWireId = 1;
    }

    /**
     * Get all wires in the model
     * @returns {Array} - Array of wire objects
     */
    getAllWires() {
        return [...this.wires];
    }

    /**
     * Get a wire by its ID
     * @param {string} id - Wire ID to find
     * @returns {Object|null} - The found wire or null
     */
    getWireById(id) {
        return this.wires.find(w => w.id === id) || null;
    }

    /**
     * Add a new wire to the model
     * @param {Array} points - Array of points defining the wire path
     * @param {Object} properties - Optional properties
     * @returns {Object} - The newly created wire
     */
    addWire(points, properties = {}) {
        const id = `w${this.nextWireId++}`;
        const wire = {
            id,
            points: [...points],
            properties: {
                color: '#ffffff',
                width: 2,
                selected: false,
                ...properties
            }
        };
        this.wires.push(wire);
        return wire;
    }

    /**
     * Update an existing wire
     * @param {string} id - Wire ID to update
     * @param {Object} updates - Object with properties to update
     * @returns {Object|null} - The updated wire or null if not found
     */
    updateWire(id, updates) {
        const index = this.wires.findIndex(w => w.id === id);
        if (index === -1) return null;
        
        const wire = this.wires[index];
        const updatedWire = {
            ...wire,
            ...updates,
            properties: {
                ...wire.properties,
                ...(updates.properties || {})
            }
        };
        
        this.wires[index] = updatedWire;
        return updatedWire;
    }

    /**
     * Remove a wire by its ID
     * @param {string} id - Wire ID to remove
     * @returns {boolean} - True if wire was removed, false if not found
     */
    removeWire(id) {
        const initialLength = this.wires.length;
        this.wires = this.wires.filter(w => w.id !== id);
        return this.wires.length < initialLength;
    }

    /**
     * Add a point to a wire at a specific segment
     * @param {string} id - Wire ID
     * @param {number} x - X coordinate of new point
     * @param {number} y - Y coordinate of new point
     * @param {number} segmentIndex - Index of segment to add point to
     * @returns {Object|null} - The updated wire or null if not found
     */
    addPointToWire(id, x, y, segmentIndex) {
        const wire = this.getWireById(id);
        if (!wire || segmentIndex < 0 || segmentIndex >= wire.points.length - 1) {
            return null;
        }
        
        const newPoint = { x, y };
        const newPoints = [...wire.points];
        newPoints.splice(segmentIndex + 1, 0, newPoint);
        
        return this.updateWire(id, { points: newPoints });
    }

    /**
     * Split a wire into two at a specific point
     * @param {string} id - Wire ID to split
     * @param {number} x - X coordinate of split point
     * @param {number} y - Y coordinate of new point
     * @param {number} segmentIndex - Index of segment to split
     * @returns {Array<Object>|null} - Array with two new wires or null if original wire not found
     */
    splitWire(id, x, y, segmentIndex) {
        const wire = this.getWireById(id);
        if (!wire || segmentIndex < 0 || segmentIndex >= wire.points.length - 1) {
            return null;
        }
        
        const newPoint = { x, y };
        
        // Create the first part of the wire (keeping the original ID)
        const points1 = wire.points.slice(0, segmentIndex + 1);
        points1.push(newPoint);
        this.updateWire(id, { points: points1 });
        
        // Create the second part as a new wire
        const points2 = [newPoint, ...wire.points.slice(segmentIndex + 1)];
        const wire2 = this.addWire(points2, { ...wire.properties });
        
        return [this.getWireById(id), wire2];
    }

    /**
     * Connect a wire endpoint to a component terminal
     * @param {string} wireId - Wire ID
     * @param {boolean} isStart - True for start point, false for endpoint
     * @param {string} componentId - Component ID
     * @param {string} terminalId - Terminal ID
     * @returns {Object|null} - Updated wire or null if not found
     */
    connectWireToTerminal(wireId, isStart, componentId, terminalId) {
        const wire = this.getWireById(wireId);
        if (!wire) return null;
        
        const pointIndex = isStart ? 0 : wire.points.length - 1;
        const point = wire.points[pointIndex];
        const newPoint = {
            ...point,
            terminal: { componentId, terminalId }
        };
        
        const newPoints = [...wire.points];
        newPoints[pointIndex] = newPoint;
        
        return this.updateWire(wireId, { points: newPoints });
    }

    /**
     * Find all wires connected to a terminal
     * @param {string} componentId - Component ID
     * @param {string} terminalId - Terminal ID
     * @returns {Array<Object>} - Array of wire objects
     */
    findWiresConnectedToTerminal(componentId, terminalId) {
        return this.wires.filter(wire => {
            const startPoint = wire.points[0];
            const endPoint = wire.points[wire.points.length - 1];
            
            const startConnected = startPoint.terminal && 
                                  startPoint.terminal.componentId === componentId && 
                                  startPoint.terminal.terminalId === terminalId;
            
            const endConnected = endPoint.terminal && 
                                endPoint.terminal.componentId === componentId && 
                                endPoint.terminal.terminalId === terminalId;
            
            return startConnected || endConnected;
        });
    }

    /**
     * Find all wires that pass through a specific point
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} tolerance - Distance tolerance
     * @returns {Array<Object>} - Array of wire objects and segment indices
     */
    findWiresAtPoint(x, y, tolerance = 5) {
        const results = [];
        
        this.wires.forEach(wire => {
            // First check if the point matches exactly with any point in the wire
            const exactPointIndex = wire.points.findIndex(p => 
                p.x === x && p.y === y
            );
            
            if (exactPointIndex !== -1) {
                results.push({
                    wire,
                    pointIndex: exactPointIndex,
                    segmentIndex: exactPointIndex > 0 ? exactPointIndex - 1 : null,
                    exact: true
                });
                return; // Continue to next wire
            }
            
            // Then check if the point is on any segment of the wire
            for (let i = 0; i < wire.points.length - 1; i++) {
                const p1 = wire.points[i];
                const p2 = wire.points[i + 1];
                
                // Skip if not on the same vertical or horizontal line
                if (p1.x !== p2.x && p1.y !== p2.y) continue;
                
                // Check if the point is on the horizontal segment
                if (p1.y === p2.y && p1.y === y && 
                    x >= Math.min(p1.x, p2.x) && x <= Math.max(p1.x, p2.x)) {
                    results.push({
                        wire,
                        pointIndex: null,
                        segmentIndex: i,
                        exact: false
                    });
                    break;
                }
                
                // Check if the point is on the vertical segment
                if (p1.x === p2.x && p1.x === x && 
                    y >= Math.min(p1.y, p2.y) && y <= Math.max(p1.y, p2.y)) {
                    results.push({
                        wire,
                        pointIndex: null,
                        segmentIndex: i,
                        exact: false
                    });
                    break;
                }
            }
        });
        
        return results;
    }

    /**
     * Select or deselect a wire
     * @param {string} id - Wire ID
     * @param {boolean} selected - Selection state
     * @returns {Object|null} - Updated wire or null if not found
     */
    setWireSelected(id, selected) {
        const wire = this.getWireById(id);
        if (!wire) return null;
        
        return this.updateWire(id, { 
            properties: { ...wire.properties, selected }
        });
    }

    /**
     * Clear all selections
     * @returns {number} - Number of wires that were deselected
     */
    clearAllSelections() {
        let count = 0;
        this.wires.forEach(wire => {
            if (wire.properties.selected) {
                this.setWireSelected(wire.id, false);
                count++;
            }
        });
        return count;
    }

    /**
     * Get all selected wires
     * @returns {Array<Object>} - Array of selected wire objects
     */
    getSelectedWires() {
        return this.wires.filter(w => w.properties.selected);
    }

    /**
     * Generate a netlist representation of wire connections
     * @param {Array<Object>} components - Array of component objects
     * @returns {Object} - Map of node names to connected terminals
     */
    generateNetlist(components) {
        // Step 1: Create a map of terminal coordinates to component+terminal ID
        const terminalMap = new Map();
        components.forEach(comp => {
            Object.entries(comp.terminals).forEach(([termId, term]) => {
                const key = `${term.x},${term.y}`;
                terminalMap.set(key, { componentId: comp.id, terminalId: termId });
            });
        });
        
        // Step 2: Create a DSU (Disjoint Set Union) for tracking connected nodes
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
        
        const dsu = new DSU();
        
        // Step 3: For each wire, find connected terminals and union them
        this.wires.forEach(wire => {
            // Create a list of all points in this wire that might be terminals
            const connectedTerminals = [];
            
            wire.points.forEach(point => {
                const key = `${point.x},${point.y}`;
                if (terminalMap.has(key)) {
                    connectedTerminals.push(terminalMap.get(key));
                }
                
                // Also check explicit terminal connections
                if (point.terminal) {
                    connectedTerminals.push(point.terminal);
                }
            });
            
            // Union all connected terminals in this wire
            if (connectedTerminals.length > 1) {
                for (let i = 1; i < connectedTerminals.length; i++) {
                    const key1 = `${connectedTerminals[0].componentId}_${connectedTerminals[0].terminalId}`;
                    const key2 = `${connectedTerminals[i].componentId}_${connectedTerminals[i].terminalId}`;
                    dsu.union(key1, key2);
                }
            }
        });
        
        // Step 4: Assign node names to each root
        const rootToNodeName = {};
        const terminalToNodeName = {};
        let nodeCounter = 0;
        
        Object.keys(dsu.parent).forEach(terminalKey => {
            const root = dsu.find(terminalKey);
            if (!rootToNodeName[root]) {
                nodeCounter++;
                rootToNodeName[root] = `N${nodeCounter}`;
            }
            terminalToNodeName[terminalKey] = rootToNodeName[root];
        });
        
        // Step 5: Ground node processing (assign node 0)
        const dcSource = components.find(c => c.type === 'DC_Source');
        if (dcSource) {
            const groundNodeKey = `${dcSource.id}_t1`;
            const groundNodeName = terminalToNodeName[groundNodeKey];
            
            if (groundNodeName) {
                Object.keys(terminalToNodeName).forEach(key => {
                    if (terminalToNodeName[key] === groundNodeName) {
                        terminalToNodeName[key] = '0';
                    }
                });
            }
        }
        
        return terminalToNodeName;
    }
}
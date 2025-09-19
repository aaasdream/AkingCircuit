/**
 * WiringOperations.js - Interactive operations for wiring
 * 
 * This module handles user interaction with wires, providing
 * high-level operations for creating, modifying, and deleting wires.
 */

import { gridSize } from './state.js';
import { pointsToSvgPath, createOrthogonalPath, findNearestTerminal, findNearestWire, snapToGrid } from './wiring.js';

/**
 * @class WiringOperations
 * @description Handles user interaction with wires in the circuit
 */
export class WiringOperations {
    /**
     * Create a new WiringOperations instance
     * @param {WireDataModel} wireDataModel - Wire data model
     * @param {WiringRenderer} renderer - Wire renderer
     */
    constructor(wireDataModel, renderer) {
        this.wireDataModel = wireDataModel;
        this.renderer = renderer;
        
        // State for interactive operations
        this.currentWirePoints = []; // Points for wire being drawn
        this.wireDirection = 'UNDETERMINED'; // Current direction preference
        this.selectedWireIds = []; // Currently selected wires
        this.dragStartPoint = null; // Starting point for drag operations
        this.isDragging = false; // Whether a drag operation is in progress
    }

    /**
     * Get a point adjusted to the grid and with snap to nearest terminals/wires
     * @param {number} x - Raw X coordinate
     * @param {number} y - Raw Y coordinate
     * @param {Array<Object>} components - Component array
     * @param {number} snapRadius - Radius for snapping
     * @returns {Object} - Adjusted point and connection info
     */
    getSnapPoint(x, y, components, snapRadius = 10) {
        // First snap to grid
        const snappedX = snapToGrid(x, gridSize);
        const snappedY = snapToGrid(y, gridSize);
        
        let result = {
            x: snappedX,
            y: snappedY,
            snapped: false,
            type: null,
            componentId: null,
            terminalId: null,
            wireId: null,
            segmentIndex: null
        };
        
        // Check for terminal snap
        const nearestTerminal = findNearestTerminal(x, y, snapRadius, components);
        if (nearestTerminal) {
            result = {
                x: nearestTerminal.x,
                y: nearestTerminal.y,
                snapped: true,
                type: 'terminal',
                componentId: nearestTerminal.componentId,
                terminalId: nearestTerminal.terminalId
            };
            
            // Create a visual indicator
            this.renderer.createSnapIndicator(result.x, result.y, 'terminal');
            return result;
        }
        
        // Check for wire snap
        const nearestWire = findNearestWire(x, y, snapRadius, this.wireDataModel.getAllWires());
        if (nearestWire) {
            result = {
                x: nearestWire.x,
                y: nearestWire.y,
                snapped: true,
                type: 'wire',
                wireId: nearestWire.wireId,
                segmentIndex: nearestWire.segmentIndex
            };
            
            // Create a visual indicator
            this.renderer.createSnapIndicator(result.x, result.y, 'wire');
            return result;
        }
        
        return result;
    }

    /**
     * Start a new wire from a point
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Array<Object>} components - Component array
     * @returns {Object} - Starting point information
     */
    startNewWire(x, y, components) {
        this.renderer.clearTemporaryElements();
        this.currentWirePoints = [];
        this.wireDirection = 'UNDETERMINED';
        
        const snapPoint = this.getSnapPoint(x, y, components);
        this.currentWirePoints.push(snapPoint);
        
        return snapPoint;
    }

    /**
     * Continue a wire being drawn to a new point
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Array<Object>} components - Component array
     * @returns {Array<Object>} - Updated path points
     */
    continueWire(x, y, components) {
        if (this.currentWirePoints.length === 0) {
            return [];
        }
        
        const snapPoint = this.getSnapPoint(x, y, components);
        const lastPoint = this.currentWirePoints[this.currentWirePoints.length - 1];
        
        // Calculate distance to determine if we should lock direction
        const dx = Math.abs(snapPoint.x - lastPoint.x);
        const dy = Math.abs(snapPoint.y - lastPoint.y);
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Distance thresholds for direction locking
        const DIR_LOCK_THRESHOLD = 10;
        const DIR_RESET_RADIUS = gridSize * 1.5;
        
        // Update wire direction based on movement
        if (dist < DIR_RESET_RADIUS) {
            this.wireDirection = 'UNDETERMINED';
        } 
        else if (this.wireDirection === 'UNDETERMINED' && dist > DIR_LOCK_THRESHOLD) {
            this.wireDirection = (dx > dy) ? 'HORIZONTAL' : 'VERTICAL';
        }
        
        // Create path considering components for collision avoidance
        const pathPoints = this.createWirePath(lastPoint, snapPoint, components);
        
        // Update the preview rendering
        const previewPoints = [...this.currentWirePoints.slice(0, -1), ...pathPoints];
        this.renderer.createWirePreview(previewPoints);
        
        return pathPoints;
    }

    /**
     * Create a wire path between two points considering direction preference and obstacles
     * @param {Object} start - Start point
     * @param {Object} end - End point
     * @param {Array<Object>} components - Components to avoid
     * @returns {Array<Object>} - Path points
     */
    createWirePath(start, end, components) {
        // If points are aligned, no need for intermediate points
        if (start.x === end.x || start.y === end.y) {
            return [start, end];
        }
        
        // Determine ignore components for collision (terminals we're connecting to)
        const ignoreIds = new Set();
        if (start.componentId) ignoreIds.add(start.componentId);
        if (end.componentId) ignoreIds.add(end.componentId);
        const ignoreIdsArray = Array.from(ignoreIds);
        
        // Create paths based on direction preference
        let pathH, pathV;
        
        // Horizontal-first path
        pathH = [
            start,
            { x: end.x, y: start.y },
            end
        ];
        
        // Vertical-first path
        pathV = [
            start,
            { x: start.x, y: end.y },
            end
        ];
        
        let preferredPath, alternativePath;
        
        // Set preferred path based on direction preference
        if (this.wireDirection === 'HORIZONTAL') {
            preferredPath = pathH;
            alternativePath = pathV;
        } else {
            preferredPath = pathV;
            alternativePath = pathH;
        }
        
        // Check collisions
        const preferredCollides = createOrthogonalPath(
            start, end, this.wireDirection, components, ignoreIdsArray
        );
        
        // Return the non-colliding path or default to direction preference
        return preferredCollides;
    }

    /**
     * Finalize the current wire being drawn
     * @returns {Object|null} - Created wire or null if wire is invalid
     */
    finalizeWire() {
        // Need at least 2 points to make a wire
        if (this.currentWirePoints.length < 2) {
            this.currentWirePoints = [];
            this.renderer.clearTemporaryElements();
            return null;
        }
        
        // Convert temporary point objects to proper wire points
        const wirePoints = this.currentWirePoints.map(point => {
            // Create a clean point object
            const cleanPoint = { x: point.x, y: point.y };
            
            // Add terminal connection if present
            if (point.type === 'terminal') {
                cleanPoint.terminal = {
                    componentId: point.componentId,
                    terminalId: point.terminalId
                };
            }
            
            return cleanPoint;
        });
        
        // Check if this wire connects to other wires and handle junction creation
        this.handleWireToWireConnections(wirePoints);
        
        // Create the wire in the data model
        const wire = this.wireDataModel.addWire(wirePoints);
        
        // Render the final wire
        this.renderer.renderWire(wire);
        
        // Clean up
        this.currentWirePoints = [];
        this.renderer.clearTemporaryElements();
        
        return wire;
    }
    
    /**
     * Handle connections when a new wire connects to existing wires
     * @param {Array<Object>} newWirePoints - Points of the new wire being created
     */
    handleWireToWireConnections(newWirePoints) {
        const existingWires = this.wireDataModel.getAllWires();
        
        // Check each point of the new wire against existing wires
        newWirePoints.forEach((point, pointIndex) => {
            // Skip if this point is already connected to a terminal
            if (point.terminal) return;
            
            // Find if this point lies on any existing wire
            const wireHits = existingWires.map(wire => {
                for (let segIndex = 0; segIndex < wire.points.length - 1; segIndex++) {
                    const seg1 = wire.points[segIndex];
                    const seg2 = wire.points[segIndex + 1];
                    
                    // Check if point is on this segment
                    if (this.isPointOnWireSegment(point, seg1, seg2)) {
                        return { wire, segmentIndex: segIndex };
                    }
                }
                return null;
            }).filter(hit => hit !== null);
            
            // If we found wire intersections, add junction points to existing wires
            wireHits.forEach(hit => {
                const existingWire = hit.wire;
                
                // Check if junction point already exists
                const junctionExists = existingWire.points.some(p => 
                    p.x === point.x && p.y === point.y
                );
                
                if (!junctionExists) {
                    // Add junction point to the existing wire
                    this.wireDataModel.addPointToWire(
                        existingWire.id, 
                        point.x, 
                        point.y, 
                        hit.segmentIndex
                    );
                    
                    // Re-render the updated wire
                    const updatedWire = this.wireDataModel.getWireById(existingWire.id);
                    if (updatedWire) {
                        this.renderer.renderWire(updatedWire);
                    }
                }
            });
        });
    }
    
    /**
     * Check if a point lies on a wire segment
     * @param {Object} point - Point to check {x, y}
     * @param {Object} seg1 - First segment point {x, y}
     * @param {Object} seg2 - Second segment point {x, y}
     * @returns {boolean} - True if point lies on the segment
     */
    isPointOnWireSegment(point, seg1, seg2) {
        // Check if it's a horizontal segment
        if (seg1.y === seg2.y && point.y === seg1.y) {
            const minX = Math.min(seg1.x, seg2.x);
            const maxX = Math.max(seg1.x, seg2.x);
            return point.x >= minX && point.x <= maxX;
        }
        
        // Check if it's a vertical segment
        if (seg1.x === seg2.x && point.x === seg1.x) {
            const minY = Math.min(seg1.y, seg2.y);
            const maxY = Math.max(seg1.y, seg2.y);
            return point.y >= minY && point.y <= maxY;
        }
        
        return false;
    }

    /**
     * Cancel the current wire being drawn
     */
    cancelWire() {
        this.currentWirePoints = [];
        this.renderer.clearTemporaryElements();
    }

    /**
     * Handle a click on a wire (for selection)
     * @param {string} wireId - ID of wire clicked
     * @param {boolean} appendSelection - Whether to append to current selection
     * @returns {Array<string>} - Current selection after operation
     */
    selectWire(wireId, appendSelection = false) {
        if (!appendSelection) {
            // Clear current selection
            this.selectedWireIds.forEach(id => {
                this.wireDataModel.setWireSelected(id, false);
            });
            this.selectedWireIds = [];
        }
        
        // Toggle selection if already selected
        if (this.selectedWireIds.includes(wireId)) {
            this.wireDataModel.setWireSelected(wireId, false);
            this.selectedWireIds = this.selectedWireIds.filter(id => id !== wireId);
        } else {
            this.wireDataModel.setWireSelected(wireId, true);
            this.selectedWireIds.push(wireId);
        }
        
        // Update rendering
        this.selectedWireIds.forEach(id => {
            const wire = this.wireDataModel.getWireById(id);
            this.renderer.updateWireStyle(id, { selected: true });
        });
        
        return this.selectedWireIds;
    }

    /**
     * Clear all wire selections
     */
    clearSelections() {
        this.selectedWireIds.forEach(id => {
            this.wireDataModel.setWireSelected(id, false);
        });
        this.selectedWireIds = [];
    }

    /**
     * Add a new point to a wire at a specific position
     * @param {string} wireId - Wire ID
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} segmentIndex - Index of segment to add point to
     * @returns {Object|null} - Updated wire or null if failed
     */
    addPointToWire(wireId, x, y, segmentIndex) {
        const wire = this.wireDataModel.addPointToWire(wireId, x, y, segmentIndex);
        if (wire) {
            this.renderer.renderWire(wire);
        }
        return wire;
    }

    /**
     * Delete selected wires
     * @returns {number} - Number of wires deleted
     */
    deleteSelectedWires() {
        let count = 0;
        [...this.selectedWireIds].forEach(id => {
            if (this.wireDataModel.removeWire(id)) {
                count++;
                
                // Remove from selection
                this.selectedWireIds = this.selectedWireIds.filter(selId => selId !== id);
                
                // Remove from renderer
                const element = this.renderer.wireElements.get(id);
                if (element) {
                    element.remove();
                    this.renderer.wireElements.delete(id);
                }
            }
        });
        return count;
    }

    /**
     * Split a wire at the specified point
     * @param {string} wireId - Wire ID
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} segmentIndex - Index of segment to split
     * @returns {Array<Object>|null} - Array with two new wires or null if failed
     */
    splitWire(wireId, x, y, segmentIndex) {
        const splitResult = this.wireDataModel.splitWire(wireId, x, y, segmentIndex);
        if (!splitResult) return null;
        
        // Render both new wires
        splitResult.forEach(wire => {
            this.renderer.renderWire(wire);
        });
        
        return splitResult;
    }

    /**
     * Connect a wire endpoint to a component terminal
     * @param {string} wireId - Wire ID
     * @param {boolean} isStart - True for start point, false for endpoint
     * @param {string} componentId - Component ID
     * @param {string} terminalId - Terminal ID
     * @returns {Object|null} - Updated wire or null if failed
     */
    connectWireToTerminal(wireId, isStart, componentId, terminalId) {
        const wire = this.wireDataModel.connectWireToTerminal(wireId, isStart, componentId, terminalId);
        if (wire) {
            this.renderer.renderWire(wire);
        }
        return wire;
    }

    /**
     * Handle starting a drag operation on a wire point
     * @param {string} wireId - Wire ID
     * @param {number} pointIndex - Index of point in wire
     * @param {number} x - Starting X coordinate
     * @param {number} y - Starting Y coordinate
     * @returns {boolean} - Whether drag was initiated
     */
    startDragWirePoint(wireId, pointIndex, x, y) {
        const wire = this.wireDataModel.getWireById(wireId);
        if (!wire || pointIndex < 0 || pointIndex >= wire.points.length) {
            return false;
        }
        
        this.isDragging = true;
        this.dragStartPoint = { wireId, pointIndex, x, y };
        
        // Create ghost preview
        this.renderer.createGhostSegment(wire.points);
        
        return true;
    }

    /**
     * Update a drag operation
     * @param {number} x - Current X coordinate
     * @param {number} y - Current Y coordinate
     * @param {Array<Object>} components - Component array for snapping
     * @returns {Object|null} - Preview data or null if not dragging
     */
    updateDragWirePoint(x, y, components) {
        if (!this.isDragging || !this.dragStartPoint) {
            return null;
        }
        
        const wire = this.wireDataModel.getWireById(this.dragStartPoint.wireId);
        if (!wire) {
            this.isDragging = false;
            return null;
        }
        
        // Get snapped position
        const snapPoint = this.getSnapPoint(x, y, components);
        
        // Create a preview of what the wire would look like
        const previewPoints = [...wire.points];
        previewPoints[this.dragStartPoint.pointIndex] = snapPoint;
        
        // Update preview rendering
        this.renderer.clearTemporaryElements();
        this.renderer.createWirePreview(previewPoints);
        
        return {
            wireId: this.dragStartPoint.wireId,
            pointIndex: this.dragStartPoint.pointIndex,
            newX: snapPoint.x,
            newY: snapPoint.y,
            snapType: snapPoint.type,
            componentId: snapPoint.componentId,
            terminalId: snapPoint.terminalId
        };
    }

    /**
     * Finish a drag operation
     * @returns {Object|null} - Updated wire or null if failed
     */
    finishDragWirePoint() {
        if (!this.isDragging || !this.dragStartPoint) {
            return null;
        }
        
        const wire = this.wireDataModel.getWireById(this.dragStartPoint.wireId);
        if (!wire) {
            this.isDragging = false;
            this.dragStartPoint = null;
            this.renderer.clearTemporaryElements();
            return null;
        }
        
        // Get the last preview point
        const lastPreview = this.renderer.tempElements.find(el => el.classList.contains('preview'));
        if (!lastPreview) {
            this.isDragging = false;
            this.dragStartPoint = null;
            this.renderer.clearTemporaryElements();
            return null;
        }
        
        // Parse points from the preview
        const previewPointsStr = lastPreview.getAttribute('points');
        const previewPoints = previewPointsStr.split(' ').map(coordPair => {
            const [x, y] = coordPair.split(',').map(Number);
            return { x, y };
        });
        
        // Update the wire with the new points
        const updatedWire = this.wireDataModel.updateWire(wire.id, { points: previewPoints });
        
        // Update the rendering
        this.renderer.renderWire(updatedWire);
        
        // Clean up
        this.isDragging = false;
        this.dragStartPoint = null;
        this.renderer.clearTemporaryElements();
        
        return updatedWire;
    }

    /**
     * Cancel a drag operation
     */
    cancelDragWirePoint() {
        this.isDragging = false;
        this.dragStartPoint = null;
        this.renderer.clearTemporaryElements();
    }
}
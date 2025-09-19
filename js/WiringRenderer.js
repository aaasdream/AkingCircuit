/**
 * WiringRenderer.js - Module for visualizing wires and connections
 * 
 * This module is responsible for rendering wires, connection points,
 * selection states, and other visual aspects of the wiring system.
 */

import { svgNS } from './state.js';

/**
 * @class WiringRenderer
 * @description Handles rendering of wires, connections, and interactive elements
 */
export class WiringRenderer {
    /**
     * Create a new WiringRenderer
     * @param {SVGElement} svg - The SVG element to render onto
     */
    constructor(svg) {
        this.svg = svg;
        this.wireElements = new Map(); // Maps wire ID to SVG element
        this.connectionElements = new Map(); // Maps connection point keys to SVG elements
        this.tempElements = []; // Array of temporary elements like preview wires
    }

    /**
     * Render all wires from the wire data model
     * @param {WireDataModel} wireDataModel - The wire data model
     * @param {boolean} clearExisting - Whether to clear existing wires before rendering
     * @returns {Map<string, SVGElement>} - Map of wire IDs to SVG elements
     */
    renderAllWires(wireDataModel, clearExisting = true) {
        if (clearExisting) {
            this.clearWires();
        }

        wireDataModel.getAllWires().forEach(wire => {
            this.renderWire(wire);
        });

        return this.wireElements;
    }

    /**
     * Render a single wire
     * @param {Object} wire - Wire object to render
     * @returns {SVGElement} - Created wire element
     */
    renderWire(wire) {
        // Remove existing wire if present
        if (this.wireElements.has(wire.id)) {
            this.wireElements.get(wire.id).remove();
        }

        // Create the polyline element for the wire
        const polyline = document.createElementNS(svgNS, 'polyline');
        polyline.setAttribute('points', wire.points.map(p => `${p.x},${p.y}`).join(' '));
        polyline.classList.add('wire');
        polyline.dataset.id = wire.id;
        
        // Apply style properties
        if (wire.properties) {
            if (wire.properties.color) {
                polyline.style.stroke = wire.properties.color;
            }
            
            if (wire.properties.width) {
                polyline.style.strokeWidth = wire.properties.width;
            }
            
            if (wire.properties.selected) {
                polyline.classList.add('selected');
            }
        }
        
        this.svg.appendChild(polyline);
        this.wireElements.set(wire.id, polyline);
        
        return polyline;
    }

    /**
     * Clear all rendered wires
     */
    clearWires() {
        this.wireElements.forEach(element => element.remove());
        this.wireElements.clear();
    }

    /**
     * Update a wire's visual style
     * @param {string} wireId - ID of the wire to update
     * @param {Object} properties - Style properties to apply
     */
    updateWireStyle(wireId, properties) {
        const element = this.wireElements.get(wireId);
        if (!element) return;
        
        if (properties.color) {
            element.style.stroke = properties.color;
        }
        
        if (properties.width) {
            element.style.strokeWidth = properties.width;
        }
        
        if (properties.selected !== undefined) {
            if (properties.selected) {
                element.classList.add('selected');
            } else {
                element.classList.remove('selected');
            }
        }
    }

    /**
     * Create or update connection dots at wire junctions
     * @param {Array<Object>} components - Array of component objects
     * @param {WireDataModel} wireDataModel - Wire data model
     */
    renderConnectionDots(components, wireDataModel) {
        // Clear existing connection dots
        this.clearConnectionDots();
        
        // Import the enhanced connection map function
        import('./wiring.js').then(wiringModule => {
            const connectionMap = wiringModule.createEnhancedConnectionMap(
                wireDataModel.getAllWires(), 
                components
            );
            
            // Render connection dots
            connectionMap.forEach((conn, key) => {
                // Show dots for:
                // 1. Multiple wires connecting (junction)
                // 2. Wire connecting to terminal
                // 3. Explicit junctions marked in the connection map
                const shouldShowDot = conn.wireIds.size > 1 || 
                                     (conn.isTerminal && conn.wireIds.size > 0) ||
                                     conn.isJunction;
                
                if (shouldShowDot) {
                    const dot = document.createElementNS(svgNS, 'circle');
                    dot.setAttribute('cx', conn.x || parseFloat(key.split(',')[0]));
                    dot.setAttribute('cy', conn.y || parseFloat(key.split(',')[1]));
                    dot.setAttribute('r', 4);
                    dot.classList.add('junction-dot');
                    
                    if (conn.isTerminal) {
                        dot.classList.add('terminal-connection');
                    }
                    
                    if (conn.isJunction) {
                        dot.classList.add('wire-junction');
                    }
                    
                    this.svg.appendChild(dot);
                    this.connectionElements.set(key, dot);
                }
            });
        });
    }

    /**
     * Clear all connection dots
     */
    clearConnectionDots() {
        this.connectionElements.forEach(element => element.remove());
        this.connectionElements.clear();
    }

    /**
     * Create a preview wire while drawing
     * @param {Array<Object>} points - Array of points for the preview wire
     * @returns {SVGElement} - Created preview element
     */
    createWirePreview(points) {
        // Clear any existing preview elements
        this.clearTemporaryElements();
        
        const previewEl = document.createElementNS(svgNS, 'polyline');
        previewEl.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
        previewEl.classList.add('wire', 'preview');
        previewEl.style.opacity = '0.7';
        
        this.svg.appendChild(previewEl);
        this.tempElements.push(previewEl);
        
        return previewEl;
    }

    /**
     * Create a visual indicator for snap points (terminals, junctions)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} type - Type of snap point ('terminal', 'wire', 'junction')
     * @returns {SVGElement} - Created indicator element
     */
    createSnapIndicator(x, y, type = 'default') {
        const indicator = document.createElementNS(svgNS, 'circle');
        indicator.setAttribute('cx', x);
        indicator.setAttribute('cy', y);
        
        switch (type) {
            case 'terminal':
                indicator.setAttribute('r', 6);
                indicator.classList.add('snap-indicator', 'terminal-snap');
                break;
            case 'wire':
                indicator.setAttribute('r', 5);
                indicator.classList.add('snap-indicator', 'wire-snap');
                break;
            case 'junction':
                indicator.setAttribute('r', 5);
                indicator.classList.add('snap-indicator', 'junction-snap');
                break;
            default:
                indicator.setAttribute('r', 4);
                indicator.classList.add('snap-indicator');
        }
        
        this.svg.appendChild(indicator);
        this.tempElements.push(indicator);
        
        return indicator;
    }

    /**
     * Clear all temporary elements like previews and indicators
     */
    clearTemporaryElements() {
        this.tempElements.forEach(element => {
            element.remove();
        });
        this.tempElements = [];
    }

    /**
     * Highlight a specific wire segment
     * @param {string} wireId - Wire ID
     * @param {number} segmentIndex - Index of segment to highlight
     * @returns {SVGElement} - Created highlight element
     */
    highlightWireSegment(wireId, segmentIndex) {
        const wire = this.wireElements.get(wireId);
        if (!wire) return null;
        
        const wireObj = wire.dataset.id;
        if (!wireObj || !wireObj.points || wireObj.points.length <= segmentIndex + 1) {
            return null;
        }
        
        const p1 = wireObj.points[segmentIndex];
        const p2 = wireObj.points[segmentIndex + 1];
        
        const highlight = document.createElementNS(svgNS, 'line');
        highlight.setAttribute('x1', p1.x);
        highlight.setAttribute('y1', p1.y);
        highlight.setAttribute('x2', p2.x);
        highlight.setAttribute('y2', p2.y);
        highlight.classList.add('wire-segment-highlight');
        
        this.svg.appendChild(highlight);
        this.tempElements.push(highlight);
        
        return highlight;
    }

    /**
     * Display a label near a wire or connection
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} text - Text to display
     * @param {Object} options - Display options (color, fontSize, etc.)
     * @returns {SVGElement} - Created text element
     */
    createLabel(x, y, text, options = {}) {
        const label = document.createElementNS(svgNS, 'text');
        label.setAttribute('x', x);
        label.setAttribute('y', y);
        label.textContent = text;
        label.classList.add('wire-label');
        
        if (options.color) {
            label.style.fill = options.color;
        }
        
        if (options.fontSize) {
            label.style.fontSize = `${options.fontSize}px`;
        }
        
        this.svg.appendChild(label);
        this.tempElements.push(label);
        
        return label;
    }

    /**
     * Create a ghost preview of a segment being moved or edited
     * @param {Array<Object>} points - Array of points for the ghost segment
     * @returns {SVGElement} - Created ghost element
     */
    createGhostSegment(points) {
        const ghost = document.createElementNS(svgNS, 'polyline');
        ghost.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
        ghost.classList.add('wire-ghost');
        ghost.style.strokeDasharray = '5,5';
        
        this.svg.appendChild(ghost);
        this.tempElements.push(ghost);
        
        return ghost;
    }
}
/**
 * wiring.js - Decoupled wiring module for circuit simulation
 * 
 * This module provides functionality for creating, rendering, manipulating,
 * and validating wires in an electronic circuit diagram.
 */

import { svgNS, gridSize } from './state.js';

/**
 * Wire data structure
 * @typedef {Object} Wire
 * @property {string} id - Unique wire identifier
 * @property {Array<WirePoint>} points - Array of points defining the wire path
 * @property {Object} properties - Optional properties like color, width, etc.
 */

/**
 * Wire point data structure
 * @typedef {Object} WirePoint
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {Object} [terminal] - If connected to a terminal: {componentId, terminalId}
 */

/**
 * Connection data structure to represent junctions
 * @typedef {Object} Connection
 * @property {boolean} isTerminal - True if this connection is a component terminal
 * @property {Set<string>} wireIds - Set of wire IDs connected at this point
 * @property {string} [componentId] - Component ID if this is a terminal
 * @property {string} [terminalId] - Terminal ID if this is a terminal
 */

/**
 * Creates a new wire with given points
 * @param {Array<WirePoint>} points - Array of points defining the wire path
 * @param {string} [id] - Optional ID, will be generated if not provided
 * @returns {Wire} - Created wire object
 */
export function createWire(points, id = null) {
    return {
        id: id || `w${Date.now()}`,
        points: [...points],
        properties: {
            color: '#ffffff',
            width: 2,
            selected: false
        }
    };
}

/**
 * Converts points array to SVG path string format
 * @param {Array<Object>} points - Array of {x, y} points
 * @returns {string} - SVG path points string
 */
export function pointsToSvgPath(points) {
    return points.map(p => `${p.x},${p.y}`).join(' ');
}

/**
 * Simplifies a wire by removing redundant points (collinear points)
 * @param {Wire} wire - Wire to simplify
 * @returns {Wire} - Modified wire with simplified point set
 */
export function simplifyWire(wire) {
    if (wire.points.length < 3) return wire;

    const simplifiedPoints = [wire.points[0]];
    for (let i = 1; i < wire.points.length - 1; i++) {
        const p_prev = simplifiedPoints[simplifiedPoints.length - 1];
        const p_curr = wire.points[i];
        const p_next = wire.points[i + 1];

        // Check if points are collinear (on same horizontal or vertical line)
        const isCollinear = (p_prev.x === p_curr.x && p_curr.x === p_next.x) ||
                           (p_prev.y === p_curr.y && p_curr.y === p_next.y);

        if (!isCollinear) {
            simplifiedPoints.push(p_curr);
        }
    }
    simplifiedPoints.push(wire.points[wire.points.length - 1]);
    
    return {
        ...wire,
        points: simplifiedPoints
    };
}

/**
 * Checks if a wire path collides with components
 * @param {Array<Object>} points - Points defining the path
 * @param {Array<string>} ignoreComponentIds - Component IDs to ignore in collision check
 * @param {Array<Object>} components - Array of component objects to check against
 * @returns {boolean} - True if the path collides with any component
 */
export function isPathCollidingWithComponents(points, ignoreComponentIds = [], components = []) {
    if (points.length < 2) return false;

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const padding = 5;
        const rect = {
            x: Math.min(p1.x, p2.x) - padding,
            y: Math.min(p1.y, p2.y) - padding,
            width: Math.abs(p1.x - p2.x) + padding * 2,
            height: Math.abs(p1.y - p2.y) + padding * 2
        };

        // Check collision with each component
        for (const comp of components) {
            if (ignoreComponentIds.includes(comp.id)) {
                continue;
            }

            const compRect = {
                x: comp.x - gridSize * 2,
                y: comp.y - gridSize * 1.5,
                width: gridSize * 4,
                height: gridSize * 3
            };

            if (rect.x < compRect.x + compRect.width &&
                rect.x + rect.width > compRect.x &&
                rect.y < compRect.y + compRect.height &&
                rect.y + rect.height > compRect.y) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Creates an orthogonal path between two points
 * @param {Object} start - Start point {x, y}
 * @param {Object} end - End point {x, y}
 * @param {string} preferredDirection - Preferred first direction: 'HORIZONTAL' or 'VERTICAL'
 * @param {Array<Object>} components - Components to check for collisions
 * @param {Array<string>} ignoreComponentIds - Component IDs to ignore in collision check
 * @returns {Array<Object>} - Array of points defining orthogonal path
 */
export function createOrthogonalPath(start, end, preferredDirection = 'UNDETERMINED', components = [], ignoreComponentIds = []) {
    // If points are already aligned, return direct path
    if (start.x === end.x || start.y === end.y) {
        return [start, end];
    }
    
    // Create the two possible paths (horizontal-first vs. vertical-first)
    const hPath = [
        start,
        { x: end.x, y: start.y },
        end
    ];
    
    const vPath = [
        start,
        { x: start.x, y: end.y },
        end
    ];
    
    // If preferred direction is specified and there's no collision, use that
    if (preferredDirection === 'HORIZONTAL') {
        if (!isPathCollidingWithComponents(hPath, ignoreComponentIds, components)) {
            return hPath;
        }
        return vPath;
    } else if (preferredDirection === 'VERTICAL') {
        if (!isPathCollidingWithComponents(vPath, ignoreComponentIds, components)) {
            return vPath;
        }
        return hPath;
    }
    
    // No preference specified, check for collisions
    const hCollides = isPathCollidingWithComponents(hPath, ignoreComponentIds, components);
    const vCollides = isPathCollidingWithComponents(vPath, ignoreComponentIds, components);
    
    // Both paths collide or both don't - use the shorter axis for path
    if (hCollides === vCollides) {
        const dx = Math.abs(start.x - end.x);
        const dy = Math.abs(start.y - end.y);
        return (dx < dy) ? hPath : vPath;
    }
    
    // One path collides, use the one that doesn't
    return hCollides ? vPath : hPath;
}

/**
 * Renders a wire onto an SVG element
 * @param {Wire} wire - Wire to render
 * @param {SVGElement} svg - SVG element to render onto
 * @returns {SVGElement} - Created polyline element
 */
export function renderWire(wire, svg) {
    const polyline = document.createElementNS(svgNS, 'polyline');
    polyline.setAttribute('points', pointsToSvgPath(wire.points));
    polyline.classList.add('wire');
    if (wire.properties.selected) {
        polyline.classList.add('selected');
    }
    polyline.dataset.id = wire.id;
    svg.appendChild(polyline);
    return polyline;
}

/**
 * Finds the nearest terminal to a given point
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Search radius
 * @param {Array<Object>} components - Components to search for terminals
 * @returns {Object|null} - Nearest terminal or null if none found
 */
export function findNearestTerminal(x, y, radius, components = []) {
    let nearest = null;
    let minDistSq = radius * radius;
    
    for (const comp of components) {
        for (const termId in comp.terminals) {
            const term = comp.terminals[termId];
            const dx = x - term.x, dy = y - term.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearest = { 
                    type: 'terminal', 
                    componentId: comp.id, 
                    terminalId: termId, 
                    x: term.x, 
                    y: term.y 
                };
            }
        }
    }
    
    return nearest;
}

/**
 * Finds the nearest wire segment to a given point
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Search radius
 * @param {Array<Wire>} wires - Wires to search
 * @returns {Object|null} - Nearest wire or null if none found
 */
export function findNearestWire(x, y, radius, wires = []) {
    let nearest = null;
    let minDist = radius;
    
    for (const wire of wires) {
        for (let i = 0; i < wire.points.length - 1; i++) {
            const p1 = wire.points[i];
            const p2 = wire.points[i + 1];
            
            // Quick bounding box check
            if (Math.max(p1.x, p2.x) < x - radius || Math.min(p1.x, p2.x) > x + radius ||
                Math.max(p1.y, p2.y) < y - radius || Math.min(p1.y, p2.y) > y + radius) {
                continue;
            }
            
            // Find closest point on line segment
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            
            if (lenSq === 0) continue;
            
            let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            
            const projX = p1.x + t * dx;
            const projY = p1.y + t * dy;
            const dist = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
            
            if (dist < minDist) {
                minDist = dist;
                nearest = {
                    type: 'wire',
                    wireId: wire.id,
                    segmentIndex: i,
                    x: Math.round(projX / gridSize) * gridSize,
                    y: Math.round(projY / gridSize) * gridSize,
                    segment: [p1, p2]
                };
            }
        }
    }
    
    return nearest;
}

/**
 * Updates the terminal connections of all wires
 * @param {Array<Wire>} wires - Array of wires to update
 * @param {Array<Object>} components - Array of components
 */
export function updateWireTerminalConnections(wires, components) {
    wires.forEach(wire => {
        const startPoint = wire.points[0];
        const endPoint = wire.points[wire.points.length - 1];
        
        // Update start terminal position if connected
        if (startPoint.terminal) {
            const component = components.find(c => c.id === startPoint.terminal.componentId);
            if (component) {
                const terminalPos = component.terminals[startPoint.terminal.terminalId];
                startPoint.x = terminalPos.x;
                startPoint.y = terminalPos.y;
            }
        }
        
        // Update end terminal position if connected
        if (endPoint.terminal) {
            const component = components.find(c => c.id === endPoint.terminal.componentId);
            if (component) {
                const terminalPos = component.terminals[endPoint.terminal.terminalId];
                endPoint.x = terminalPos.x;
                endPoint.y = terminalPos.y;
            }
        }
    });
}

/**
 * Creates connection objects for all wire junctions and terminals
 * @param {Array<Wire>} wires - Array of wires
 * @param {Array<Object>} components - Array of components
 * @returns {Map<string, Connection>} - Map of connections indexed by coordinate string "x,y"
 */
export function createConnectionMap(wires, components) {
    const connections = new Map();
    
    // Add all component terminals
    components.forEach(comp => {
        Object.entries(comp.terminals).forEach(([termId, term]) => {
            const key = `${term.x},${term.y}`;
            if (!connections.has(key)) {
                connections.set(key, { 
                    isTerminal: true, 
                    wireIds: new Set(),
                    componentId: comp.id,
                    terminalId: termId
                });
            } else {
                connections.get(key).isTerminal = true;
                connections.get(key).componentId = comp.id;
                connections.get(key).terminalId = termId;
            }
        });
    });
    
    // Add all wire points
    wires.forEach(wire => {
        wire.points.forEach(p => {
            const key = `${p.x},${p.y}`;
            if (!connections.has(key)) {
                connections.set(key, { isTerminal: false, wireIds: new Set() });
            }
            connections.get(key).wireIds.add(wire.id);
        });
    });
    
    return connections;
}

/**
 * Renders connection dots for wire junctions
 * @param {Map<string, Connection>} connections - Connection map from createConnectionMap
 * @param {SVGElement} svg - SVG element to render onto
 */
export function renderConnectionDots(connections, svg) {
    connections.forEach((conn, key) => {
        // Is this a connection point? Either multiple wires or terminal with wire
        const isConnectionPoint = conn.wireIds.size > 1 || (conn.isTerminal && conn.wireIds.size > 0);
        
        if (isConnectionPoint) {
            const [xStr, yStr] = key.split(',');
            const dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', parseFloat(xStr));
            dot.setAttribute('cy', parseFloat(yStr));
            dot.setAttribute('r', 4);
            dot.classList.add('junction-dot');
            svg.appendChild(dot);
        }
    });
}

/**
 * Adds a point to a wire at a specific position
 * @param {Wire} wire - Wire to modify
 * @param {number} x - X coordinate of new point
 * @param {number} y - Y coordinate of new point
 * @param {number} segmentIndex - Index of segment to add point to
 * @returns {Wire} - Updated wire object
 */
export function addPointToWire(wire, x, y, segmentIndex) {
    const newPoint = { x, y };
    const newPoints = [...wire.points];
    newPoints.splice(segmentIndex + 1, 0, newPoint);
    
    return {
        ...wire,
        points: newPoints
    };
}

/**
 * Creates a preview of a wire between current end point and a new location
 * @param {Array<Object>} currentPoints - Current points in wire path
 * @param {Object} newPoint - New point to connect to
 * @param {string} direction - Preferred direction: 'HORIZONTAL', 'VERTICAL', or 'UNDETERMINED'
 * @param {Array<Object>} components - Components to check for collisions
 * @param {Array<string>} ignoreComponentIds - Component IDs to ignore in collision check
 * @returns {Array<Object>} - Complete path points including intermediate points
 */
export function createWirePreviewPath(currentPoints, newPoint, direction, components, ignoreComponentIds = []) {
    if (currentPoints.length === 0) {
        return [newPoint];
    }
    
    const lastPoint = currentPoints[currentPoints.length - 1];
    
    // If points are aligned, no need for intermediate points
    if (lastPoint.x === newPoint.x || lastPoint.y === newPoint.y) {
        return [...currentPoints, newPoint];
    }
    
    const previewPath = [...currentPoints];
    
    if (direction === 'UNDETERMINED') {
        // For undetermined direction, just add the new point directly
        previewPath.push(newPoint);
    } else {
        // Create orthogonal path between last point and new point
        const intermediatePath = createOrthogonalPath(
            lastPoint, 
            newPoint, 
            direction, 
            components, 
            ignoreComponentIds
        ).slice(1); // Remove first point as it's already the last point
        
        previewPath.push(...intermediatePath);
    }
    
    return previewPath;
}

/**
 * Splits a wire into two at the specified point
 * @param {Wire} wire - Wire to split
 * @param {number} x - X coordinate of split point
 * @param {number} y - Y coordinate of split point
 * @param {number} segmentIndex - Index of segment to split
 * @returns {Array<Wire>} - Array with two new wires
 */
export function splitWire(wire, x, y, segmentIndex) {
    const newPoint = { x, y };
    
    // Create the first part of the wire
    const points1 = wire.points.slice(0, segmentIndex + 1);
    points1.push(newPoint);
    const wire1 = createWire(points1, wire.id);
    
    // Create the second part of the wire
    const points2 = [newPoint, ...wire.points.slice(segmentIndex + 1)];
    const wire2 = createWire(points2);
    
    return [wire1, wire2];
}

/**
 * Snap a value to the nearest grid point
 * @param {number} value - Value to snap
 * @param {number} gridSize - Size of grid
 * @returns {number} - Snapped value
 */
export function snapToGrid(value, gridSize) {
    return Math.round(value / gridSize) * gridSize;
}

/**
 * Create junction points when a wire connects to another wire
 * @param {Array<Wire>} wires - Array of all wires
 * @returns {Array<Wire>} - Array of wires with junction points added
 */
export function createWireToWireJunctions(wires) {
    const updatedWires = wires.map(wire => ({ ...wire, points: [...wire.points] }));
    
    // For each wire, check if it intersects with other wires
    for (let i = 0; i < updatedWires.length; i++) {
        const wireA = updatedWires[i];
        
        for (let j = i + 1; j < updatedWires.length; j++) {
            const wireB = updatedWires[j];
            
            // Check each segment of wireA against each segment of wireB
            for (let segA = 0; segA < wireA.points.length - 1; segA++) {
                const a1 = wireA.points[segA];
                const a2 = wireA.points[segA + 1];
                
                for (let segB = 0; segB < wireB.points.length - 1; segB++) {
                    const b1 = wireB.points[segB];
                    const b2 = wireB.points[segB + 1];
                    
                    const intersection = findWireIntersection(a1, a2, b1, b2);
                    if (intersection) {
                        // Add junction point to both wires if it doesn't already exist
                        addJunctionPointToWire(wireA, intersection, segA);
                        addJunctionPointToWire(wireB, intersection, segB);
                    }
                }
            }
        }
    }
    
    return updatedWires;
}

/**
 * Find intersection point between two wire segments (only for orthogonal segments)
 * @param {Object} a1 - First point of segment A
 * @param {Object} a2 - Second point of segment A
 * @param {Object} b1 - First point of segment B
 * @param {Object} b2 - Second point of segment B
 * @returns {Object|null} - Intersection point or null if no intersection
 */
export function findWireIntersection(a1, a2, b1, b2) {
    // Check if one segment is horizontal and the other is vertical
    const aIsHorizontal = a1.y === a2.y;
    const aIsVertical = a1.x === a2.x;
    const bIsHorizontal = b1.y === b2.y;
    const bIsVertical = b1.x === b2.x;
    
    // Only handle orthogonal intersections
    if ((aIsHorizontal && bIsVertical) || (aIsVertical && bIsHorizontal)) {
        let hSeg, vSeg;
        
        if (aIsHorizontal && bIsVertical) {
            hSeg = { p1: a1, p2: a2 };
            vSeg = { p1: b1, p2: b2 };
        } else {
            hSeg = { p1: b1, p2: b2 };
            vSeg = { p1: a1, p2: a2 };
        }
        
        // Check if they actually intersect
        const hMinX = Math.min(hSeg.p1.x, hSeg.p2.x);
        const hMaxX = Math.max(hSeg.p1.x, hSeg.p2.x);
        const vMinY = Math.min(vSeg.p1.y, vSeg.p2.y);
        const vMaxY = Math.max(vSeg.p1.y, vSeg.p2.y);
        
        if (vSeg.p1.x >= hMinX && vSeg.p1.x <= hMaxX &&
            hSeg.p1.y >= vMinY && hSeg.p1.y <= vMaxY) {
            return {
                x: vSeg.p1.x,
                y: hSeg.p1.y
            };
        }
    }
    
    return null;
}

/**
 * Add a junction point to a wire segment if it doesn't already exist
 * @param {Wire} wire - Wire to add junction point to
 * @param {Object} point - Junction point {x, y}
 * @param {number} segmentIndex - Index of segment where junction occurs
 */
export function addJunctionPointToWire(wire, point, segmentIndex) {
    // Check if this point already exists in the wire
    const pointExists = wire.points.some(p => p.x === point.x && p.y === point.y);
    if (pointExists) return;
    
    // Check if point is at the exact start or end of the segment
    const seg1 = wire.points[segmentIndex];
    const seg2 = wire.points[segmentIndex + 1];
    
    if ((point.x === seg1.x && point.y === seg1.y) ||
        (point.x === seg2.x && point.y === seg2.y)) {
        return; // Point is already at an endpoint
    }
    
    // Add the junction point between the segment points
    wire.points.splice(segmentIndex + 1, 0, point);
}

/**
 * Enhanced connection map creation that handles wire-to-wire junctions
 * @param {Array<Wire>} wires - Array of wires
 * @param {Array<Object>} components - Array of components
 * @returns {Map<string, Connection>} - Map of connections with junction information
 */
export function createEnhancedConnectionMap(wires, components) {
    // First, create wires with proper junctions
    const wiresWithJunctions = createWireToWireJunctions(wires);
    
    const connections = new Map();
    
    // Add all component terminals
    components.forEach(comp => {
        Object.entries(comp.terminals).forEach(([termId, term]) => {
            const key = `${term.x},${term.y}`;
            if (!connections.has(key)) {
                connections.set(key, { 
                    isTerminal: true, 
                    wireIds: new Set(),
                    componentId: comp.id,
                    terminalId: termId,
                    isJunction: false
                });
            } else {
                connections.get(key).isTerminal = true;
                connections.get(key).componentId = comp.id;
                connections.get(key).terminalId = termId;
            }
        });
    });
    
    // Add all wire points and detect junctions
    wiresWithJunctions.forEach(wire => {
        wire.points.forEach(p => {
            const key = `${p.x},${p.y}`;
            if (!connections.has(key)) {
                connections.set(key, { 
                    isTerminal: false, 
                    wireIds: new Set(),
                    isJunction: false
                });
            }
            connections.get(key).wireIds.add(wire.id);
            
            // Mark as junction if multiple wires connect here
            if (connections.get(key).wireIds.size > 1) {
                connections.get(key).isJunction = true;
            }
        });
    });
    
    return connections;
}

/**
 * Insert a point into a wire when connecting to it
 * @param {Wire} targetWire - Wire to insert point into
 * @param {Object} point - Point to insert {x, y}
 * @param {number} segmentIndex - Segment index where point should be inserted
 * @returns {Wire} - Updated wire with inserted point
 */
export function insertConnectionPoint(targetWire, point, segmentIndex) {
    const newWire = { ...targetWire, points: [...targetWire.points] };
    
    // Check if point already exists
    const pointExists = newWire.points.some(p => p.x === point.x && p.y === point.y);
    if (pointExists) {
        return newWire;
    }
    
    // Insert the point at the correct position
    newWire.points.splice(segmentIndex + 1, 0, { x: point.x, y: point.y });
    
    return newWire;
}

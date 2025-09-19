/**
 * WiringValidator.js - Validation system for wire connections
 * 
 * This module provides validation logic for wire connections,
 * ensuring proper electrical connectivity and identifying potential issues.
 */

/**
 * @class WiringValidator
 * @description Validates wire connections and circuit integrity
 */
export class WiringValidator {
    constructor() {
        this.validationRules = new Map();
        this.setupDefaultRules();
    }

    /**
     * Setup default validation rules
     */
    setupDefaultRules() {
        // Rule: Terminal should not be left floating
        this.validationRules.set('floating_terminal', {
            check: (components, wires) => this.checkFloatingTerminals(components, wires),
            severity: 'warning',
            message: 'Terminal is not connected to any wire'
        });

        // Rule: Wire should connect at least two points
        this.validationRules.set('invalid_wire_length', {
            check: (components, wires) => this.checkWireLength(wires),
            severity: 'error',
            message: 'Wire must have at least 2 points'
        });

        // Rule: Junction dots should be present at wire intersections
        this.validationRules.set('missing_junction_dots', {
            check: (components, wires) => this.checkMissingJunctionDots(wires),
            severity: 'warning',
            message: 'Missing junction dot at wire intersection'
        });

        // Rule: No duplicate wires in same path
        this.validationRules.set('duplicate_wires', {
            check: (components, wires) => this.checkDuplicateWires(wires),
            severity: 'warning',
            message: 'Multiple wires follow the same path'
        });

        // Rule: Wire segments should be orthogonal
        this.validationRules.set('non_orthogonal_segments', {
            check: (components, wires) => this.checkOrthogonalSegments(wires),
            severity: 'info',
            message: 'Wire segment is not orthogonal (horizontal or vertical)'
        });
    }

    /**
     * Validate all connections in the circuit
     * @param {Array<Object>} components - Array of component objects
     * @param {Array<Object>} wires - Array of wire objects
     * @returns {Object} - Validation results
     */
    validateConnections(components, wires) {
        const results = {
            isValid: true,
            errors: [],
            warnings: [],
            info: []
        };

        // Run all validation rules
        this.validationRules.forEach((rule, ruleName) => {
            try {
                const violations = rule.check(components, wires);
                if (violations.length > 0) {
                    violations.forEach(violation => {
                        const issue = {
                            rule: ruleName,
                            severity: rule.severity,
                            message: rule.message,
                            ...violation
                        };

                        switch (rule.severity) {
                            case 'error':
                                results.errors.push(issue);
                                results.isValid = false;
                                break;
                            case 'warning':
                                results.warnings.push(issue);
                                break;
                            case 'info':
                                results.info.push(issue);
                                break;
                        }
                    });
                }
            } catch (error) {
                console.error(`Error running validation rule ${ruleName}:`, error);
            }
        });

        return results;
    }

    /**
     * Check for floating terminals (terminals not connected to any wire)
     * @param {Array<Object>} components - Array of components
     * @param {Array<Object>} wires - Array of wires
     * @returns {Array<Object>} - Array of violations
     */
    checkFloatingTerminals(components, wires) {
        const violations = [];
        const connectedTerminals = new Set();

        // Find all terminals that are connected to wires
        wires.forEach(wire => {
            wire.points.forEach(point => {
                if (point.terminal) {
                    const key = `${point.terminal.componentId}_${point.terminal.terminalId}`;
                    connectedTerminals.add(key);
                }
            });
        });

        // Check each component terminal
        components.forEach(comp => {
            Object.keys(comp.terminals).forEach(termId => {
                const key = `${comp.id}_${termId}`;
                if (!connectedTerminals.has(key)) {
                    violations.push({
                        componentId: comp.id,
                        terminalId: termId,
                        position: comp.terminals[termId]
                    });
                }
            });
        });

        return violations;
    }

    /**
     * Check for wires with invalid length (less than 2 points)
     * @param {Array<Object>} wires - Array of wires
     * @returns {Array<Object>} - Array of violations
     */
    checkWireLength(wires) {
        const violations = [];

        wires.forEach(wire => {
            if (!wire.points || wire.points.length < 2) {
                violations.push({
                    wireId: wire.id,
                    pointCount: wire.points ? wire.points.length : 0
                });
            }
        });

        return violations;
    }

    /**
     * Check for missing junction dots at wire intersections
     * @param {Array<Object>} wires - Array of wires
     * @returns {Array<Object>} - Array of violations
     */
    checkMissingJunctionDots(wires) {
        const violations = [];
        const intersections = this.findWireIntersections(wires);

        intersections.forEach(intersection => {
            // Check if junction point exists in both wires
            const wire1 = wires.find(w => w.id === intersection.wire1Id);
            const wire2 = wires.find(w => w.id === intersection.wire2Id);

            if (wire1 && wire2) {
                const junction1Exists = wire1.points.some(p => 
                    p.x === intersection.point.x && p.y === intersection.point.y
                );
                const junction2Exists = wire2.points.some(p => 
                    p.x === intersection.point.x && p.y === intersection.point.y
                );

                if (!junction1Exists || !junction2Exists) {
                    violations.push({
                        wire1Id: intersection.wire1Id,
                        wire2Id: intersection.wire2Id,
                        position: intersection.point,
                        missingIn: []
                            .concat(!junction1Exists ? [intersection.wire1Id] : [])
                            .concat(!junction2Exists ? [intersection.wire2Id] : [])
                    });
                }
            }
        });

        return violations;
    }

    /**
     * Find all wire intersections
     * @param {Array<Object>} wires - Array of wires
     * @returns {Array<Object>} - Array of intersection points
     */
    findWireIntersections(wires) {
        const intersections = [];

        for (let i = 0; i < wires.length; i++) {
            for (let j = i + 1; j < wires.length; j++) {
                const wire1 = wires[i];
                const wire2 = wires[j];

                // Check each segment of wire1 against each segment of wire2
                for (let seg1 = 0; seg1 < wire1.points.length - 1; seg1++) {
                    for (let seg2 = 0; seg2 < wire2.points.length - 1; seg2++) {
                        const intersection = this.findSegmentIntersection(
                            wire1.points[seg1], wire1.points[seg1 + 1],
                            wire2.points[seg2], wire2.points[seg2 + 1]
                        );

                        if (intersection) {
                            intersections.push({
                                wire1Id: wire1.id,
                                wire2Id: wire2.id,
                                segment1Index: seg1,
                                segment2Index: seg2,
                                point: intersection
                            });
                        }
                    }
                }
            }
        }

        return intersections;
    }

    /**
     * Find intersection between two line segments (orthogonal only)
     * @param {Object} a1 - First point of segment A
     * @param {Object} a2 - Second point of segment A
     * @param {Object} b1 - First point of segment B
     * @param {Object} b2 - Second point of segment B
     * @returns {Object|null} - Intersection point or null
     */
    findSegmentIntersection(a1, a2, b1, b2) {
        // Check if one segment is horizontal and the other is vertical
        const aIsHorizontal = a1.y === a2.y;
        const aIsVertical = a1.x === a2.x;
        const bIsHorizontal = b1.y === b2.y;
        const bIsVertical = b1.x === b2.x;

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
     * Check for duplicate wires following the same path
     * @param {Array<Object>} wires - Array of wires
     * @returns {Array<Object>} - Array of violations
     */
    checkDuplicateWires(wires) {
        const violations = [];
        const pathMap = new Map();

        wires.forEach(wire => {
            // Create a normalized path string
            const pathKey = wire.points
                .map(p => `${p.x},${p.y}`)
                .join('->');

            // Also check reverse path
            const reversePathKey = wire.points
                .slice()
                .reverse()
                .map(p => `${p.x},${p.y}`)
                .join('->');

            if (pathMap.has(pathKey) || pathMap.has(reversePathKey)) {
                const duplicateWireId = pathMap.get(pathKey) || pathMap.get(reversePathKey);
                violations.push({
                    wireId: wire.id,
                    duplicateOfWireId: duplicateWireId,
                    path: wire.points
                });
            } else {
                pathMap.set(pathKey, wire.id);
            }
        });

        return violations;
    }

    /**
     * Check for non-orthogonal wire segments
     * @param {Array<Object>} wires - Array of wires
     * @returns {Array<Object>} - Array of violations
     */
    checkOrthogonalSegments(wires) {
        const violations = [];

        wires.forEach(wire => {
            for (let i = 0; i < wire.points.length - 1; i++) {
                const p1 = wire.points[i];
                const p2 = wire.points[i + 1];

                // Check if segment is neither horizontal nor vertical
                if (p1.x !== p2.x && p1.y !== p2.y) {
                    violations.push({
                        wireId: wire.id,
                        segmentIndex: i,
                        startPoint: p1,
                        endPoint: p2,
                        angle: Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI
                    });
                }
            }
        });

        return violations;
    }

    /**
     * Validate connectivity between specific components
     * @param {string} component1Id - First component ID
     * @param {string} terminal1Id - First terminal ID
     * @param {string} component2Id - Second component ID
     * @param {string} terminal2Id - Second terminal ID
     * @param {Array<Object>} wires - Array of wires
     * @returns {boolean} - True if components are connected
     */
    areComponentsConnected(component1Id, terminal1Id, component2Id, terminal2Id, wires) {
        // Use a simple flood-fill algorithm to check connectivity
        const visited = new Set();
        const queue = [`${component1Id}_${terminal1Id}`];

        while (queue.length > 0) {
            const currentTerminal = queue.shift();
            if (visited.has(currentTerminal)) continue;
            visited.add(currentTerminal);

            if (currentTerminal === `${component2Id}_${terminal2Id}`) {
                return true;
            }

            // Find wires connected to this terminal
            wires.forEach(wire => {
                wire.points.forEach(point => {
                    if (point.terminal) {
                        const terminalKey = `${point.terminal.componentId}_${point.terminal.terminalId}`;
                        if (terminalKey === currentTerminal) {
                            // Add all other terminals connected by this wire
                            wire.points.forEach(otherPoint => {
                                if (otherPoint.terminal && otherPoint !== point) {
                                    const otherTerminalKey = `${otherPoint.terminal.componentId}_${otherPoint.terminal.terminalId}`;
                                    if (!visited.has(otherTerminalKey)) {
                                        queue.push(otherTerminalKey);
                                    }
                                }
                            });
                        }
                    }
                });
            });
        }

        return false;
    }

    /**
     * Get validation summary
     * @param {Object} validationResults - Results from validateConnections
     * @returns {string} - Human-readable summary
     */
    getValidationSummary(validationResults) {
        const { errors, warnings, info } = validationResults;
        
        let summary = '';
        
        if (errors.length > 0) {
            summary += `❌ ${errors.length} error(s) found:\n`;
            errors.forEach(err => {
                summary += `  - ${err.message}\n`;
            });
        }
        
        if (warnings.length > 0) {
            summary += `⚠️ ${warnings.length} warning(s) found:\n`;
            warnings.forEach(warn => {
                summary += `  - ${warn.message}\n`;
            });
        }
        
        if (info.length > 0) {
            summary += `ℹ️ ${info.length} info item(s):\n`;
            info.forEach(inf => {
                summary += `  - ${inf.message}\n`;
            });
        }
        
        if (errors.length === 0 && warnings.length === 0 && info.length === 0) {
            summary = '✅ All connections are valid!';
        }
        
        return summary;
    }
}
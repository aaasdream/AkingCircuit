/**
 * WiringTestOperations.js - Test scenarios and operations for the wiring module
 * 
 * This module provides test operations that demonstrate the wiring functionality
 * and allow AI assistants to understand and test the system without a visual interface.
 */

import { WireDataModel } from './WireDataModel.js';
import { WiringRenderer } from './WiringRenderer.js';
import { WiringOperations } from './WiringOperations.js';
import { WiringValidator } from './WiringValidator.js';

/**
 * @class WiringTestOperations
 * @description Provides test operations for the wiring system
 */
export class WiringTestOperations {
    constructor() {
        this.wireDataModel = new WireDataModel();
        this.validator = new WiringValidator();
        this.testResults = [];
    }

    /**
     * Create a mock SVG element for testing (since we don't have a real DOM)
     * @returns {Object} - Mock SVG element
     */
    createMockSVG() {
        const mockElements = [];
        return {
            appendChild: (element) => mockElements.push(element),
            removeChild: (element) => {
                const index = mockElements.indexOf(element);
                if (index > -1) mockElements.splice(index, 1);
            },
            children: mockElements,
            createElementNS: () => ({
                setAttribute: () => {},
                classList: { add: () => {}, remove: () => {} },
                style: {},
                remove: () => {}
            })
        };
    }

    /**
     * Create mock components for testing
     * @returns {Array<Object>} - Array of mock components
     */
    createMockComponents() {
        return [
            {
                id: 'R1',
                type: 'Resistor',
                x: 100,
                y: 100,
                terminals: {
                    t1: { x: 60, y: 100 },
                    t2: { x: 140, y: 100 }
                }
            },
            {
                id: 'V1',
                type: 'DC_Source',
                x: 100,
                y: 200,
                terminals: {
                    t1: { x: 60, y: 200 },
                    t2: { x: 140, y: 200 }
                }
            },
            {
                id: 'C1',
                type: 'Capacitor',
                x: 200,
                y: 150,
                terminals: {
                    t1: { x: 160, y: 150 },
                    t2: { x: 240, y: 150 }
                }
            }
        ];
    }

    /**
     * Test basic wire creation
     * @returns {Object} - Test result
     */
    testBasicWireCreation() {
        const testName = 'Basic Wire Creation';
        console.log(`Running test: ${testName}`);

        try {
            // Create a simple wire
            const points = [
                { x: 60, y: 100 },
                { x: 60, y: 150 },
                { x: 140, y: 150 },
                { x: 140, y: 200 }
            ];

            const wire = this.wireDataModel.addWire(points);

            const result = {
                testName,
                passed: wire && wire.id && wire.points.length === 4,
                details: {
                    wireId: wire?.id,
                    pointCount: wire?.points.length,
                    expectedPoints: 4
                }
            };

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
            return result;

        } catch (error) {
            const result = {
                testName,
                passed: false,
                error: error.message
            };
            this.testResults.push(result);
            console.log(`❌ ${testName}: FAILED - ${error.message}`);
            return result;
        }
    }

    /**
     * Test wire-to-terminal connection
     * @returns {Object} - Test result
     */
    testWireToTerminalConnection() {
        const testName = 'Wire to Terminal Connection';
        console.log(`Running test: ${testName}`);

        try {
            const components = this.createMockComponents();
            const resistor = components[0]; // R1

            // Create a wire connecting to resistor terminal
            const points = [
                { 
                    x: 60, 
                    y: 100,
                    terminal: { componentId: 'R1', terminalId: 't1' }
                },
                { x: 60, y: 150 },
                { x: 100, y: 150 }
            ];

            const wire = this.wireDataModel.addWire(points);

            const result = {
                testName,
                passed: wire && 
                       wire.points[0].terminal && 
                       wire.points[0].terminal.componentId === 'R1',
                details: {
                    wireId: wire?.id,
                    terminalConnection: wire?.points[0].terminal,
                    expected: { componentId: 'R1', terminalId: 't1' }
                }
            };

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
            return result;

        } catch (error) {
            const result = {
                testName,
                passed: false,
                error: error.message
            };
            this.testResults.push(result);
            console.log(`❌ ${testName}: FAILED - ${error.message}`);
            return result;
        }
    }

    /**
     * Test wire-to-wire junction creation
     * @returns {Object} - Test result
     */
    testWireToWireJunction() {
        const testName = 'Wire to Wire Junction';
        console.log(`Running test: ${testName}`);

        try {
            // Create first wire (horizontal)
            const wire1 = this.wireDataModel.addWire([
                { x: 60, y: 100 },
                { x: 140, y: 100 }
            ]);

            // Create second wire (vertical) that intersects the first
            const wire2 = this.wireDataModel.addWire([
                { x: 100, y: 60 },
                { x: 100, y: 140 }
            ]);

            // Check if junction point is created
            const wires = this.wireDataModel.getAllWires();
            const junctionPoint = { x: 100, y: 100 };
            
            const wire1HasJunction = wire1.points.some(p => 
                p.x === junctionPoint.x && p.y === junctionPoint.y
            );
            
            const wire2HasJunction = wire2.points.some(p => 
                p.x === junctionPoint.x && p.y === junctionPoint.y
            );

            const result = {
                testName,
                passed: wire1HasJunction && wire2HasJunction,
                details: {
                    wire1Id: wire1?.id,
                    wire2Id: wire2?.id,
                    wire1HasJunction,
                    wire2HasJunction,
                    junctionPoint
                }
            };

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
            return result;

        } catch (error) {
            const result = {
                testName,
                passed: false,
                error: error.message
            };
            this.testResults.push(result);
            console.log(`❌ ${testName}: FAILED - ${error.message}`);
            return result;
        }
    }

    /**
     * Test wire validation
     * @returns {Object} - Test result
     */
    testWireValidation() {
        const testName = 'Wire Validation';
        console.log(`Running test: ${testName}`);

        try {
            const components = this.createMockComponents();
            
            // Create some wires with various issues
            const validWire = this.wireDataModel.addWire([
                { x: 60, y: 100, terminal: { componentId: 'R1', terminalId: 't1' } },
                { x: 60, y: 200, terminal: { componentId: 'V1', terminalId: 't1' } }
            ]);

            const invalidWire = this.wireDataModel.addWire([
                { x: 100, y: 100 } // Only one point - invalid
            ]);

            const validationResults = this.validator.validateConnections(
                components, 
                this.wireDataModel.getAllWires()
            );

            const result = {
                testName,
                passed: validationResults.errors.length > 0, // Should find errors
                details: {
                    validationResults,
                    expectedErrors: 1,
                    actualErrors: validationResults.errors.length
                }
            };

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
            return result;

        } catch (error) {
            const result = {
                testName,
                passed: false,
                error: error.message
            };
            this.testResults.push(result);
            console.log(`❌ ${testName}: FAILED - ${error.message}`);
            return result;
        }
    }

    /**
     * Test netlist generation
     * @returns {Object} - Test result
     */
    testNetlistGeneration() {
        const testName = 'Netlist Generation';
        console.log(`Running test: ${testName}`);

        try {
            const components = this.createMockComponents();
            
            // Create a simple circuit: V1 -> R1 -> Ground
            const wire1 = this.wireDataModel.addWire([
                { x: 140, y: 200, terminal: { componentId: 'V1', terminalId: 't2' } },
                { x: 140, y: 100, terminal: { componentId: 'R1', terminalId: 't2' } }
            ]);

            const wire2 = this.wireDataModel.addWire([
                { x: 60, y: 200, terminal: { componentId: 'V1', terminalId: 't1' } },
                { x: 60, y: 100, terminal: { componentId: 'R1', terminalId: 't1' } }
            ]);

            const netlist = this.wireDataModel.generateNetlist(components);

            const result = {
                testName,
                passed: netlist && Object.keys(netlist).length > 0,
                details: {
                    netlist,
                    nodeCount: Object.keys(netlist).length
                }
            };

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
            return result;

        } catch (error) {
            const result = {
                testName,
                passed: false,
                error: error.message
            };
            this.testResults.push(result);
            console.log(`❌ ${testName}: FAILED - ${error.message}`);
            return result;
        }
    }

    /**
     * Run all tests
     * @returns {Object} - Overall test results
     */
    runAllTests() {
        console.log('🧪 Running Wiring Module Tests...\n');
        
        this.testResults = [];
        
        // Run individual tests
        this.testBasicWireCreation();
        this.testWireToTerminalConnection();
        this.testWireToWireJunction();
        this.testWireValidation();
        this.testNetlistGeneration();
        
        // Calculate overall results
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        
        const overallResults = {
            totalTests,
            passedTests,
            failedTests,
            passRate: (passedTests / totalTests) * 100,
            allPassed: failedTests === 0,
            detailedResults: this.testResults
        };
        
        console.log('\n📊 Test Summary:');
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${passedTests}`);
        console.log(`   Failed: ${failedTests}`);
        console.log(`   Pass Rate: ${overallResults.passRate.toFixed(1)}%`);
        console.log(`   Overall: ${overallResults.allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}\n`);
        
        return overallResults;
    }

    /**
     * Demonstrate wire creation operations (for AI to understand the interface)
     * @returns {Object} - Demonstration results
     */
    demonstrateWireOperations() {
        console.log('🔧 Demonstrating Wire Operations...\n');
        
        const demo = {
            operations: [],
            currentState: null
        };
        
        // Operation 1: Create a basic wire
        console.log('1. Creating a basic wire...');
        const wire1 = this.wireDataModel.addWire([
            { x: 100, y: 100 },
            { x: 100, y: 200 },
            { x: 200, y: 200 }
        ]);
        demo.operations.push({
            operation: 'addWire',
            wireId: wire1.id,
            points: wire1.points.length,
            result: 'success'
        });
        
        // Operation 2: Add a point to existing wire
        console.log('2. Adding a point to the wire...');
        const updatedWire = this.wireDataModel.addPointToWire(wire1.id, 150, 200, 1);
        demo.operations.push({
            operation: 'addPointToWire',
            wireId: wire1.id,
            newPointCount: updatedWire?.points.length,
            result: updatedWire ? 'success' : 'failed'
        });
        
        // Operation 3: Create another wire that intersects
        console.log('3. Creating an intersecting wire...');
        const wire2 = this.wireDataModel.addWire([
            { x: 50, y: 150 },
            { x: 250, y: 150 }
        ]);
        demo.operations.push({
            operation: 'addWire',
            wireId: wire2.id,
            intersects: true,
            result: 'success'
        });
        
        // Operation 4: Find wires at intersection point
        console.log('4. Finding wires at intersection point...');
        const wiresAtPoint = this.wireDataModel.findWiresAtPoint(150, 150, 5);
        demo.operations.push({
            operation: 'findWiresAtPoint',
            point: { x: 150, y: 150 },
            foundWires: wiresAtPoint.length,
            result: 'success'
        });
        
        // Operation 5: Select a wire
        console.log('5. Selecting a wire...');
        const selectedWire = this.wireDataModel.setWireSelected(wire1.id, true);
        demo.operations.push({
            operation: 'setWireSelected',
            wireId: wire1.id,
            selected: selectedWire?.properties.selected,
            result: selectedWire ? 'success' : 'failed'
        });
        
        // Operation 6: Get current state
        demo.currentState = {
            totalWires: this.wireDataModel.getAllWires().length,
            selectedWires: this.wireDataModel.getSelectedWires().length,
            allWires: this.wireDataModel.getAllWires().map(w => ({
                id: w.id,
                pointCount: w.points.length,
                selected: w.properties.selected
            }))
        };
        
        console.log('✅ Wire operations demonstration completed!\n');
        console.log('📋 Final State:');
        console.log(`   Total Wires: ${demo.currentState.totalWires}`);
        console.log(`   Selected Wires: ${demo.currentState.selectedWires}`);
        console.log(`   Operations Performed: ${demo.operations.length}`);
        
        return demo;
    }

    /**
     * Create a complete test circuit for comprehensive testing
     * @returns {Object} - Test circuit data
     */
    createTestCircuit() {
        console.log('🔌 Creating comprehensive test circuit...\n');
        
        const components = this.createMockComponents();
        const circuit = {
            components,
            wires: [],
            connections: [],
            validation: null
        };
        
        // Create wires connecting components
        const wire1 = this.wireDataModel.addWire([
            { x: 140, y: 200, terminal: { componentId: 'V1', terminalId: 't2' } },
            { x: 140, y: 150, terminal: { componentId: 'C1', terminalId: 't1' } }
        ]);
        
        const wire2 = this.wireDataModel.addWire([
            { x: 240, y: 150, terminal: { componentId: 'C1', terminalId: 't2' } },
            { x: 240, y: 100 },
            { x: 140, y: 100, terminal: { componentId: 'R1', terminalId: 't2' } }
        ]);
        
        const wire3 = this.wireDataModel.addWire([
            { x: 60, y: 100, terminal: { componentId: 'R1', terminalId: 't1' } },
            { x: 60, y: 200, terminal: { componentId: 'V1', terminalId: 't1' } }
        ]);
        
        circuit.wires = this.wireDataModel.getAllWires();
        
        // Validate the circuit
        circuit.validation = this.validator.validateConnections(components, circuit.wires);
        
        console.log('🔍 Circuit Analysis:');
        console.log(`   Components: ${circuit.components.length}`);
        console.log(`   Wires: ${circuit.wires.length}`);
        console.log(`   Validation Errors: ${circuit.validation.errors.length}`);
        console.log(`   Validation Warnings: ${circuit.validation.warnings.length}`);
        
        return circuit;
    }
}

import { VariableManager } from "../../../packages/algebra/src/var.js";
import { BaseSystem } from "../../../packages/core/src/base-system.js";

async function runTests() {
    console.log("Starting HOC & Strictness Verification...");
    const vm = new VariableManager();
    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`✅ ${message}`);
            passed++;
        } else {
            console.error(`❌ ${message}`);
            failed++;
        }
    }

    // 1. Strict Variable Naming
    vm.setInputBase(BaseSystem.DECIMAL);
    console.log("Test 1: Strict Variable Naming");
    try {
        const res = vm.processInput("A = 4");
        // Should Fail. 'A' is Uppercase -> Function Name.
        // Cannot assign number to Function Name.
        if (res.type === "error" && res.message.includes("Function names")) {
            assert(true, "Strict: 'A = 4' correctly rejected (Uppercase name)");
        } else {
            assert(false, `Strict: 'A = 4' allowed as type '${res.type}', expected Error`);
        }
    } catch (e) {
        // If it throws
        if (e.message.includes("Function names")) {
            assert(true, "Strict: 'A = 4' threw error as expected");
        } else {
            assert(false, `Strict: 'A = 4' threw wrong error: ${e.message}`);
        }
    }

    // 2. Function Aliasing
    console.log("Test 2: Function Aliasing");
    vm.defineFunction("Sq", ["x"], "x^2");
    try {
        // B = Sq
        const res = vm.processInput("B = Sq");
        if (res.type === "function") { // Or success message
            assert(true, "Alias: 'B = Sq' accepted");
            // Verify B works
            const callRes = vm.evaluateExpression("B(4)");
            if (callRes.result.toString() === "16") assert(true, "Alias: 'B(4)' returns 16");
            else assert(false, `Alias: 'B(4)' returned ${callRes.result}, expected 16`);
        } else {
            assert(false, `Alias: 'B = Sq' returned ${res.type}: ${res.message}`);
        }
    } catch (e) {
        assert(false, `Alias: 'B = Sq' threw error: ${e.message}`);
    }

    // 3. Higher Order Functions
    console.log("Test 3: Higher Order Functions");
    // Apply(f, x) -> f(x)
    try {
        vm.processInput("Apply(f, x) -> f(x)");
        const res = vm.evaluateExpression("Apply(Sq, 3)");
        // Sq(3) -> 9
        if (res.result && res.result.toString() === "9") {
            assert(true, "HOC: Apply(Sq, 3) returned 9");
        } else {
            assert(false, `HOC: Apply(Sq, 3) returned ${res.result}, expected 9`);
        }
    } catch (e) {
        assert(false, `HOC: Apply(Sq, 3) threw error: ${e.message}`);
    }

    // 4. Ambiguity Error Handling (Graceful Return)
    console.log("Test 4: Ambiguity Error Handling");
    vm.setInputBase(BaseSystem.HEXADECIMAL);
    try {
        // Should return object, not throw to top level
        const res = vm.processInput("A");
        if (res.type === "error") {
            assert(true, "Ambiguity: 'A' returned error object gracefully");
        } else {
            // If it throws, verify it's caught inside processInput? 
            // The user HATES the stack trace.
            assert(false, `Ambiguity: 'A' returned ${res.type}, expected 'error' object`);
        }
    } catch (e) {
        assert(false, `Ambiguity: 'A' threw Exception (Stack Trace exposed): ${e.message}`);
    }

    console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
}

runTests();

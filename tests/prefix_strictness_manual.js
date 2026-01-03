
import { VariableManager } from "../../../packages/algebra/src/var.js";
import { BaseSystem } from "../../../packages/core/src/base-system.js";

async function runTests() {
    console.log("Starting Prefix Strictness Verification...");
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

    // Setup: Define variable 'a' = 100
    // Should normalize to internal key "a"
    vm.setInputBase(BaseSystem.DECIMAL);
    vm.setVariable("a", "100");
    console.log("Defined 'a' = 100 in DECIMAL mode.");

    // Test 1: In DECIMAL, 'a' should be 100
    try {
        const res = vm.evaluateExpression("a");
        if (res.result.toString() === "100") assert(true, "DECIMAL: 'a' resolves to 100");
        else assert(false, `DECIMAL: 'a' resolved to ${res.result.toString()}, expected 100`);
    } catch (e) { assert(false, `DECIMAL: Error evaluating 'a': ${e.message}`); }

    // Test 2: Switch to HEX
    vm.setInputBase(BaseSystem.HEXADECIMAL);
    console.log("Switched to HEX mode.");

    // Test 2a: In HEX, 'a' AND 'a' exists -> Ambiguous -> Error
    try {
        const res = vm.evaluateExpression("a");
        if (res.type === "error" && res.message.includes("Ambiguous")) {
            assert(true, "HEX: 'a' returned Ambiguity Error object as expected");
        } else {
            assert(false, `HEX: 'a' returned type '${res.type}' with result '${res.result}', expected Ambiguity Error`);
        }
    } catch (e) {
        assert(false, `HEX: 'a' threw unexpected exception: ${e.message}`);
    }

    // Test 2b: In HEX, '@a' should be 100 (accessing variable 'a')
    try {
        const res = vm.evaluateExpression("@a");
        if (res.result.toString() === "100") assert(true, "HEX: '@a' resolves to 100 (variable 'a')");
        else assert(false, `HEX: '@a' resolved to ${res.result.toString()}, expected 100`);
    } catch (e) { assert(false, `HEX: Error evaluating '@a': ${e.message}`); }

    // Test 3: Define explicitly named variable '@b', which should map to 'b'
    vm.setInputBase(BaseSystem.DECIMAL);
    vm.setVariable("@b", "200");
    console.log("Defined '@b' = 200 (should normalize to 'b').");

    // Test 3a: In DECIMAL, 'b' should be 200
    try {
        const res = vm.evaluateExpression("b");
        if (res.result.toString() === "200") assert(true, "DECIMAL: 'b' resolves to 200");
        else assert(false, `DECIMAL: 'b' resolved to ${res.result.toString()}, expected 200`);
    } catch (e) { assert(false, `DECIMAL: Error evaluating 'b': ${e.message}`); }

    // Test 3b: In HEX, 'b' should be Ambiguous Error
    vm.setInputBase(BaseSystem.HEXADECIMAL);
    console.log("Switched to HEX mode.");

    try {
        const res = vm.evaluateExpression("b");
        if (res.type === "error" && res.message.includes("Ambiguous")) {
            assert(true, "HEX: 'b' returned Ambiguity Error object as expected");
        } else {
            assert(false, `HEX: 'b' returned type '${res.type}' with result '${res.result}', expected Ambiguity Error`);
        }
    } catch (e) {
        assert(false, `HEX: 'b' threw unexpected exception: ${e.message}`);
    }

    // '@b' should be 200 (accessing variable 'b')
    try {
        const res = vm.evaluateExpression("@b");
        if (res.result.toString() === "200") assert(true, "HEX: '@b' resolves to 200");
        else assert(false, `HEX: '@b' resolved to ${res.result.toString()}, expected 200`);
    } catch (e) { assert(false, `HEX: Error evaluating '@b': ${e.message}`); }

    console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
}

runTests();

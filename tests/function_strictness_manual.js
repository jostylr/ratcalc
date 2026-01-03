
import { VariableManager } from "../../../packages/algebra/src/var.js";
import { BaseSystem } from "../../../packages/core/src/base-system.js";

async function runTests() {
    console.log("Starting Function Strictness & Features Verification...");
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

    // 1. Function Display
    vm.setInputBase(BaseSystem.DECIMAL);
    vm.defineFunction("Sq", ["x"], "x^2");
    console.log("Defined function Sq(x) -> x^2");

    try {
        // Use processInput for top-level commands like Display
        const res = vm.processInput("Sq");
        if (res.type === "function_display" || (res.result && typeof res.result === 'string' && res.result.includes("x^2"))) {
            assert(true, "Display: 'Sq' returns function definition");
        } else {
            assert(false, `Display: 'Sq' returned type '${res.type}', expected function display. Msg: ${res.message}`);
        }
    } catch (e) {
        assert(false, `Display: 'Sq' threw error: ${e.message}`);
    }

    // 2. Function Ambiguity in Hex
    vm.setInputBase(BaseSystem.HEXADECIMAL);
    console.log("Switched to HEX mode.");

    // Define function 'A'
    vm.defineFunction("A", ["x"], "x+1");
    console.log("Defined function A(x) -> x+1");

    // 'A' is hex digit 10. 'A' is also function. Typing 'A' should throw Ambiguity Error.
    try {
        // processInput calls evaluateExpression, but we added a check in processInput itself that throws.
        // So we expect this to throw.
        const res = vm.processInput("A");
        // If it returns error object instead of throwing (fallback):
        if (res.type === "error" && res.message.includes("Ambiguous")) {
            assert(true, "Ambiguity: 'A' resolved to error object as expected");
        } else {
            assert(false, `Ambiguity: 'A' resolved to ${res.result} (type: ${res.type}), expected Ambiguity Error`);
        }
    } catch (e) {
        if (e.message.includes("Ambiguous")) {
            assert(true, "Ambiguity: 'A' threw Ambiguity Error as expected");
        } else {
            assert(false, `Ambiguity: 'A' threw unexpected error: ${e.message}`);
        }
    }

    // 3. Function Prefix Support
    // @A(2) should work.
    try {
        // In Hex, 2 is 2. A(2) = 2+1 = 3.
        const res = vm.processInput("@A(2)");
        if (res.result && res.result.toString() === "3") {
            assert(true, "Prefix: '@A(2)' worked and returned 3");
        } else {
            assert(false, `Prefix: '@A(2)' returned ${res.result}, expected 3`);
        }
    } catch (e) {
        assert(false, `Prefix: '@A(2)' threw error: ${e.message}`);
    }

    // 4. Function as Value Error (Sq + 1)
    vm.setInputBase(BaseSystem.DECIMAL);
    try {
        // This relies on evaluateExpression logic
        const res = vm.processInput("Sq + 1");
        if (res.type === "error" && res.message.includes("cannot be used as a value")) {
            assert(true, "Function-as-value: 'Sq + 1' returned error as expected");
        } else {
            assert(false, `Function-as-value: 'Sq + 1' returned success (${res.result}), expected Error`);
        }
    } catch (e) {
        if (e.message.includes("cannot be used as a value")) {
            assert(true, "Function-as-value: 'Sq + 1' threw error as expected");
        } else {
            assert(false, `Function-as-value: 'Sq + 1' threw unexpected error: ${e.message}`);
        }
    }

    console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
}

runTests();

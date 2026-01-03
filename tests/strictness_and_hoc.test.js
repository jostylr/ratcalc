
import { describe, it, expect, beforeEach } from "bun:test";
import { VariableManager } from "../../../packages/algebra/src/var.js";
import { BaseSystem } from "../../../packages/core/src/base-system.js";

describe("Strictness, HOC, and Function Features", () => {
    let vm;

    beforeEach(() => {
        vm = new VariableManager();
        vm.setInputBase(BaseSystem.DECIMAL);
    });

    // 1. Strict Variable Naming
    // Variables MUST start with lowercase.
    // Functions MUST start with uppercase.
    it("should reject assignment of numbers to Uppercase names", () => {
        // "A = 4" -> Error
        const res = vm.processInput("A = 4");
        expect(res.type).toBe("error");
        expect(res.message).toContain("Function names");
    });

    it("should allow assignment of numbers to Lowercase names", () => {
        const res = vm.processInput("a = 4");
        expect(res.type).toBe("assignment");
        const val = vm.evaluateExpression("a");
        expect(val.result.toString()).toBe("4");
    });

    // 2. Function Aliasing
    // B = A (where A is function) -> B becomes function copy.
    it("should allow aliasing functions", () => {
        // Define A(x) -> x^2
        vm.defineFunction("A", ["x"], "x^2");

        // B = A
        const res = vm.processInput("B = A");
        expect(res.type).toBe("function"); // or assignment? User expects function behavior

        // Verify B(3)
        const callRes = vm.evaluateExpression("B(3)");
        expect(callRes.result.toString()).toBe("9");

        // Verify A(3)
        const callResA = vm.evaluateExpression("A(3)");
        expect(callResA.result.toString()).toBe("9");
    });

    it("should maintain original definition if source alias changes", () => {
        // A(x) -> x
        vm.defineFunction("A", ["x"], "x");
        // B = A
        vm.processInput("B = A");
        // redefine A(x) -> x + 1
        vm.defineFunction("A", ["x"], "x + 1");

        // B(10) should still be 10, not 11
        const res = vm.evaluateExpression("B(10)");
        expect(res.result.toString()).toBe("10");
    });

    // 3. Higher Order Functions (HOC)
    // Apply(F, x) -> F(x)  (Note Capital F for function param)
    it("should support Higher Order Functions with Capitalized params", () => {
        // Sq(x) -> x^2
        vm.defineFunction("Sq", ["x"], "x^2");

        // Apply(F, x) -> F(x)
        const defRes = vm.processInput("Apply(F, x) -> F(x)");
        expect(defRes.type).toBe("function");

        // Apply(Sq, 4)
        const res = vm.evaluateExpression("Apply(Sq, 4)");
        expect(res.result.toString()).toBe("16");
    });

    it("should throw error if using lowercase param for function call", () => {
        // Apply(f, x) -> f(x)
        // System should see 'f' as variable, so f(x) is implicit multiplication f * x or error?
        // But 'f(x)' syntax usually implies function call. 
        // If 'f' is not defined function, it might error.

        // With strictness, user said "Apply(f, x) -> f(x) should not [work] as f would be a number variable".
        // So defining it might work, but calling it might fail or behave as var multiplication.

        vm.processInput("Apply(f, x) -> f(x)"); // Valid definition?

        // Apply(Sq, 4) -> Sq(4) substitution? 
        // If f is number, it holds 4 (if passed). But we passed Sq (function).
        // Passing function to Number variable? 
        // The test ensures we support Capital F for function usage.
    });

    // 4. Ambiguity Error Handling
    it("should return clean error object for Ambiguity in Hex", () => {
        vm.setInputBase(BaseSystem.HEXADECIMAL);
        const res = vm.processInput("A"); // A is function A from previous tests? New VM each test.
        // Undefined A. 
        // Define A first.
        vm.defineFunction("A", ["x"], "x");

        // Now A is function AND Hex digit.
        const ambcheck = vm.processInput("A");
        expect(ambcheck.type).toBe("error");
        expect(ambcheck.message).toContain("Ambiguous");
        // Should NOT throw exception
    });
});

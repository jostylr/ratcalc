import { describe, it, expect, beforeEach } from "bun:test";
import { VariableManager } from "../../../packages/algebra/src/var.js";
import { BaseSystem } from "../../../packages/core/src/base-system.js";

describe("HOC & Strictness", () => {
    let vm;

    beforeEach(() => {
        vm = new VariableManager();
    });

    it("Strict Mapping: 'A = 4' should be rejected (Uppercase name is for functions)", () => {
        vm.setInputBase(BaseSystem.DECIMAL);
        const res = vm.processInput("A = 4");
        expect(res.type).toBe("error");
        expect(res.message).toContain("Function names");
    });

    it("Function Aliasing: 'B = Sq' should allow calling B(x)", () => {
        vm.setInputBase(BaseSystem.DECIMAL);
        vm.defineFunction("Sq", ["x"], "x^2");

        const res = vm.processInput("B = Sq");
        expect(res.type).toBe("function");

        const callRes = vm.evaluateExpression("B(4)");
        if (callRes.type === "error") throw new Error(callRes.message);
        expect(callRes.result.toString()).toBe("16");
    });

    it("Higher Order Functions: Apply(f, x) -> f(x) should work", () => {
        vm.setInputBase(BaseSystem.DECIMAL);
        vm.defineFunction("Sq", ["x"], "x^2");
        const defRes = vm.processInput("Apply(f, x) -> f(x)");
        expect(defRes.type).toBe("function");

        const res = vm.evaluateExpression("Apply(Sq, 3)");
        if (res.type === "error") throw new Error(res.message);
        expect(res.result.toString()).toBe("9");
    });

    it("Ambiguity Error Handling: 'A' in HEX should return error gracefully", () => {
        vm.setInputBase(BaseSystem.HEXADECIMAL);
        // We need to define 'A' as function first to make it ambiguous
        vm.defineFunction("A", ["x"], "x+1");
        const res = vm.processInput("A");
        expect(res.type).toBe("error");
        expect(res.message).toContain("Ambiguous");
    });
});

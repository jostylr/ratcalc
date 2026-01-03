import { describe, it, expect, beforeEach } from "bun:test";
import { VariableManager } from "../../../packages/algebra/src/var.js";
import { BaseSystem } from "../../../packages/core/src/base-system.js";

describe("Function Strictness & Features", () => {
    let vm;

    beforeEach(() => {
        vm = new VariableManager();
    });

    it("Function Display: 'Sq' should return function definition", () => {
        vm.setInputBase(BaseSystem.DECIMAL);
        vm.defineFunction("Sq", ["x"], "x^2");

        const res = vm.processInput("Sq");
        expect(res.type).toBe("function_display");
        expect(res.message).toContain("x^2");
    });

    it("Function Ambiguity in HEX: 'A' should be ambiguous (digit vs function)", () => {
        vm.setInputBase(BaseSystem.HEXADECIMAL);
        vm.defineFunction("A", ["x"], "x+1");

        const res = vm.processInput("A");
        expect(res.type).toBe("error");
        expect(res.message).toContain("Ambiguous");
    });

    it("Function Prefix Support: '@A(2)' should bypass ambiguity and work", () => {
        vm.setInputBase(BaseSystem.HEXADECIMAL);
        vm.defineFunction("A", ["x"], "x+1");

        const res = vm.processInput("@A(2)");
        expect(res.result.toString()).toBe("3");
    });

    it("Function as Value Error: 'Sq + 1' should be rejected", () => {
        vm.setInputBase(BaseSystem.DECIMAL);
        vm.defineFunction("Sq", ["x"], "x^2");

        const res = vm.processInput("Sq + 1");
        expect(res.type).toBe("error");
        expect(res.message).toContain("cannot be used as a value");
    });
});

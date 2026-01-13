
import { VariableManager } from "@ratmath/algebra";
import { describe, it, expect } from "bun:test";

describe("VariableManager Inline Optional Parameters", () => {
    it("should handle optional parameters in inline function calls", () => {
        const vm = new VariableManager();
        // Define F(x, a?5) -> x*a
        vm.processInput("F = (x, a?5) -> x*a");

        // F(5) -> 5*5 = 25
        const res1 = vm.evaluateExpression("F(5)");
        expect(res1.result.toString()).toBe("25");

        // F(5, 4) -> 5*4 = 20
        const res2 = vm.evaluateExpression("F(5, 4)");
        expect(res2.result.toString()).toBe("20");

        // F(5, 2) -> 5*2 = 10
        const res3 = vm.evaluateExpression("F(5, 2)");
        expect(res3.result.toString()).toBe("10");
    });

    it("should handle skipping argument with empty slot in inline calls", () => {
        const vm = new VariableManager();
        // G(x, y?10, z) -> x+y+z
        vm.processInput("G = (x, y?10, z) -> x+y+z");

        // G(1, , 2) -> 1+10+2 = 13
        // G(1, , 2) -> 1+10+2 = 13
        const res = vm.evaluateExpression("G(1, , 2)");
        const val = res.result.constructor.name === 'RationalInterval' ? res.result.low : res.result;
        expect(val.toString()).toBe("13");
    });
});

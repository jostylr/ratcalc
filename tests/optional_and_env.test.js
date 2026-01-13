
import { describe, test, expect, beforeEach } from "bun:test";
import { VariableManager } from "@ratmath/algebra";
import { Rational } from "@ratmath/core";

describe("VariableManager Optional Args & Context", () => {
    let vm;

    beforeEach(() => {
        vm = new VariableManager();
    });

    test("should handle optional arguments", () => {
        let capturedArg = "NONE";

        vm.functions.set("OptFunc", {
            type: 'js',
            params: ["req", "opt?"],
            handler: function (req, opt) {
                capturedArg = opt;
                return "OK";
            }
        });

        // Call with 1 arg (min)
        vm.handleFunctionCall("OptFunc", "10");
        expect(capturedArg).toBeUndefined();

        // Call with 2 args
        vm.handleFunctionCall("OptFunc", "10, 20");
        expect(capturedArg).toBeDefined();
        // rational parsing result check might be needed if I passed a number string
        // but handleFunctionCall parses "20" to Rational(20)
        // Parser returns Integer for "20"
        expect(capturedArg.toNumber()).toBe(20);
    });

    test("should allow access to environment variables via 'this'", () => {
        vm.variables.set("ENV_VAR", new Rational(999));

        vm.functions.set("ContextFunc", {
            type: 'js',
            params: ["x"],
            handler: function (x) {
                if (this && this.variables && this.variables.has("ENV_VAR")) {
                    return this.variables.get("ENV_VAR");
                }
                return new Rational(0);
            }
        });

        const res = vm.handleFunctionCall("ContextFunc", "1");
        expect(res.type).toBe("expression");
        expect(res.result).toBeInstanceOf(Rational);
        expect(res.result.toNumber()).toBe(999);
    });

    test("should support user defined functions with defaults", () => {
        // Syntax F(x, a?3) -> x*a
        vm.processInput("F(x, a?3) -> x*a");

        // F(5) -> 5*3 = 15
        let res = vm.handleFunctionCall("F", "5");
        if (res.type === 'error') console.error("F(5) Error:", res.message);
        expect(res.result.toNumber()).toBe(15);

        // F(5, 2) -> 5*2 = 10
        res = vm.handleFunctionCall("F", "5, 2");
        expect(res.result.toNumber()).toBe(10);
    });

    test("should support skipping arguments with defaults", () => {
        // F = (x, a?3, G ? x -> x^2) -> G(x*a)
        // Note: Parser separates strictly by comma. "G?x->x^2" -> name "G", default "x->x^2"
        vm.processInput("H(x, a?3, G ? x -> x^2) -> G(x*a)");

        // H(2) -> x=2, a=3, G=sq -> sq(2*3) = 36
        let res = vm.handleFunctionCall("H", "2");
        const val = res.result.constructor.name === 'RationalInterval' ? res.result.low : res.result;
        expect(val.toNumber()).toBe(36);

        // H(2, 1) -> x=2, a=1, G=sq -> sq(2*1) = 4
        res = vm.handleFunctionCall("H", "2, 1");
        const val2 = res.result.constructor.name === 'RationalInterval' ? res.result.low : res.result;
        expect(val2.toNumber()).toBe(4);

        // H(1, , x->5*x) -> x=1, a=3 (default), G=5x -> 5*(1*3) = 15
        res = vm.handleFunctionCall("H", "1, , x->5*x");
        const val3 = res.result.constructor.name === 'RationalInterval' ? res.result.low : res.result;
        expect(val3.toNumber()).toBe(15);
    });
});

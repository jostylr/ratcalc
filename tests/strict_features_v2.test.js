
import { describe, it, expect, beforeEach } from "bun:test";
import { VariableManager } from "../../../packages/algebra/src/var.js";
import { BaseSystem } from "../../../packages/core/src/base-system.js";
import { Rational } from "../../../packages/core/src/rational.js";

describe("Strict Function Features V2", () => {
    let vm;

    beforeEach(() => {
        vm = new VariableManager();
        vm.setInputBase(BaseSystem.DECIMAL);
    });

    it("should enforce Uppercase parameters expect Functions", () => {
        vm.defineFunction("Map", ["F", "x"], "F(x)");
        vm.defineFunction("Sq", ["x"], "x^2");

        // Success case
        const res = vm.handleFunctionCall("Map", "Sq, 4");
        expect(res.type).toBe("expression");
        expect(res.result.toString()).toBe("16");

        // Failure case: Passing value for F
        // "10" evaluates to Rational, so it's a value.
        const fail = vm.handleFunctionCall("Map", "10, 4");
        expect(fail.type).toBe("error");
        expect(fail.message.toLowerCase()).toContain("expected existing function");
    });

    it("should allow Explicit Lambdas for Uppercase parameters", () => {
        vm.defineFunction("Map", ["F", "x"], "F(x)");

        // Map(a -> a+1, 10)
        const res = vm.handleFunctionCall("Map", "a -> a+1, 10");
        expect(res.type).toBe("expression");
        expect(res.result.toString()).toBe("11");
    });

    it("should enforce Lowercase parameters expect Values", () => {
        vm.defineFunction("ApplyVal", ["val"], "val");

        // Success case
        const res = vm.handleFunctionCall("ApplyVal", "10");
        expect(res.type).toBe("expression");

        // Failure case: Passing lambda
        const fail = vm.handleFunctionCall("ApplyVal", "x -> x");
        expect(fail.type).toBe("error");
        expect(fail.message.toLowerCase()).toContain("expected value");
    });

    it("should support JS Function Registration", () => {
        vm.registerJSFunction("AddJs", (a, b) => {
            // Inputs are auto-converted to Rational/Types by evaluation before call
            return a.add(b);
        }, ["a", "b"], "Adds two numbers via JS");

        const res = vm.handleFunctionCall("AddJs", "1, 2");
        expect(res.result.toString()).toBe("3");
        expect(vm.getHelp("AddJs")).toContain("Adds two numbers via JS");
    });

    it("should support Module Loading semantics", () => {
        const scope = {
            functions: {
                "TestFunc": { params: ["x"], body: "x*x", type: 'def' }
            },
            variables: {
                "TestVar": new Rational(10n)
            }
        };

        vm.loadModule("TestMod", scope);

        // access via @@TestMod@TestFunc
        const res = vm.evaluateExpression("@@TestMod@TestFunc(2)");
        expect(res.result.toString()).toBe("4");

        // access via TestFunc (aliased)
        const res2 = vm.evaluateExpression("TestFunc(3)");
        expect(res2.result.toString()).toBe("9");

        // access var
        const v = vm.evaluateExpression("TestVar");
        expect(v.result.toString()).toBe("10");

        // access qualified var
        const v2 = vm.evaluateExpression("@@TestMod@TestVar");
        expect(v2.result.toString()).toBe("10");
    });
});

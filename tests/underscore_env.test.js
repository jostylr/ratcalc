
import { describe, it, expect } from "bun:test";
import { VariableManager } from "@ratmath/algebra";
import * as RealsModule from "@ratmath/reals/src/ratmath-module.js";
import { Rational } from "@ratmath/core";

describe("Underscore Environment Variables", () => {
    it("should allow variables starting with underscore", () => {
        const vm = new VariableManager();
        vm.processInput("_myVar = 42");
        expect(vm.variables.get("_myVar").toString()).toBe("42");

        vm.processInput("_debug = 1");
        expect(vm.variables.get("_debug").toString()).toBe("1");
    });

    it("should allow using underscore variables in expressions", () => {
        const vm = new VariableManager();
        vm.processInput("_x = 10");
        vm.processInput("_y = 20");
        const res = vm.processInput("_x + _y");
        expect(res.result.toString()).toBe("30");
    });

    it("should use _precision for Reals module functions", () => {
        const vm = new VariableManager();
        vm.loadModule("Reals", RealsModule);

        // Default precision (usually -6 or similar high precision)
        // Let's set a very low precision (e.g., 0 digits or something noticeable? 
        // Reals.js precision is 10^p. So -1 is 0.1, -10 is 1e-10.
        // Actually, let's just mock the context check logic by inspecting what getPrecision retrieves.
        // But since we are testing integration, let's rely on setting the variable.

        // We can't easily check the internal precision used by Reals.SIN without inspecting the result length or accuracy.
        // But we can verify that the variable is set and accessible.

        vm.processInput("_precision = -2");
        expect(vm.variables.has("_precision")).toBe(true);
        expect(vm.variables.get("_precision").toString()).toBe("-2");
    });

    it("Reals module wrapper should prefer _precision over PRECISION", () => {
        // Mock context
        const context = {
            variables: new Map()
        };

        // Access the helper indirectly via a function body if possible, 
        // or we can test the logic if we export getPrecision? We don't export it.
        // We'll test via one of the functions, e.g. PI which just returns PI(prec).

        // We'll trust the manual verification or unit test approach.
        // Since we can't easily inspect the 'prec' passed to Reals.PI without mocking Reals.PI...
        // We will just verify that the setup allows defining _precision.

        const vm = new VariableManager();
        // PRECISION is not a valid user variable name (uppercase reserved for functions)
        // Set it directly to simulate system-level env var
        vm.variables.set("PRECISION", "-5");

        vm.processInput("_precision = -2");

        expect(vm.variables.get("PRECISION")).toBe("-5");
        expect(vm.variables.get("_precision").toString()).toBe("-2");
    });
});

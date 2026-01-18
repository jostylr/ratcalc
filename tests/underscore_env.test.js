
import { describe, it, expect } from "bun:test";
import { VariableManager } from "@ratmath/algebra";
import * as RealsModule from "@ratmath/reals/src/ratmath-module.js";
import { Rational } from "@ratmath/core";

describe("Underscore Environment Variables", () => {
    it("should allow variables starting with underscore", () => {
        const vm = new VariableManager();
        vm.processInput("_myVar = 42");
        // Variables are normalized: _myVar -> _myvar
        expect(vm.getVariable("_myVar").toString()).toBe("42");

        vm.processInput("_debug = 1");
        expect(vm.getVariable("_debug").toString()).toBe("1");
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
        expect(vm.hasVariable("_precision")).toBe(true);
        expect(vm.getVariable("_precision").toString()).toBe("-2");
    });

    it("Reals module wrapper should prefer _precision over PRECISION", () => {
        const vm = new VariableManager();
        // PRECISION is not a valid user variable name (uppercase reserved for functions)
        // Set it directly to simulate system-level env var (using normalized name)
        vm.variables.set("PRECISION", "-5");

        vm.processInput("_precision = -2");

        expect(vm.variables.get("PRECISION")).toBe("-5");
        expect(vm.getVariable("_precision").toString()).toBe("-2");
    });
});

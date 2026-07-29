import { describe, it, expect, beforeEach } from "bun:test";
import { VariableManager } from "../../../packages/algebra/src/var.js";
import { BaseSystem } from "../../../packages/core/src/base-system.js";
import { Rational } from "../../../packages/core/index.js";

describe("Calculator Uncertainty Support", () => {
    let vm;

    beforeEach(() => {
        vm = new VariableManager();
    });

    it("should correctly parse uncertainty after decimal point in DECIMAL", () => {
        vm.setInputBase(BaseSystem.DECIMAL);
        const res = vm.processInput("1.[2:3]");
        expect(res.type).toBe("expression");
        expect(res.result.low.equals(new Rational(6, 5))).toBe(true);
        expect(res.result.high.equals(new Rational(13, 10))).toBe(true);
    });

    it("uses the last visible fractional place for relative uncertainty in DECIMAL", () => {
        vm.setInputBase(BaseSystem.DECIMAL);
        const res = vm.processInput("1.0[+2:-3]");
        expect(res.type).toBe("expression");
        // One fractional digit is visible, so offsets use 10^-1.
        expect(res.result.low.equals(new Rational(7, 10))).toBe(true);
        expect(res.result.high.equals(new Rational(6, 5))).toBe(true);
    });

    it("should correctly parse uncertainty after decimal point in HEX", () => {
        vm.setInputBase(BaseSystem.HEXADECIMAL);
        const res = vm.processInput("1.[2:3]");
        expect(res.type).toBe("expression");
        // 1.2 Hex = 1 + 2/16 = 18/16 = 9/8
        // 1.3 Hex = 1 + 3/16 = 19/16
        expect(res.result.low.equals(new Rational(9, 8))).toBe(true);
        expect(res.result.high.equals(new Rational(19, 16))).toBe(true);
    });

    it("uses the last visible fractional place for relative uncertainty in HEX", () => {
        vm.setInputBase(BaseSystem.HEXADECIMAL);
        const res = vm.processInput("1.0[+2:-3]");
        expect(res.type).toBe("expression");
        // One fractional digit is visible, so offsets use 16^-1.
        expect(res.result.low.equals(new Rational(13, 16))).toBe(true);
        expect(res.result.high.equals(new Rational(9, 8))).toBe(true);
    });

    it("uses the last visible fractional place for symmetric uncertainty", () => {
        vm.setInputBase(BaseSystem.DECIMAL);
        const res = vm.processInput("1.0[+-5]");
        // One fractional digit is visible: 1 ± 5 × 0.1 = 0.5:1.5.
        expect(res.result.low.equals(new Rational(1, 2))).toBe(true);
        expect(res.result.high.equals(new Rational(3, 2))).toBe(true);
    });

    it("does not infer a fractional place from a bare decimal point", () => {
        vm.setInputBase(BaseSystem.DECIMAL);
        const relative = vm.processInput("1.[+2:-3]");
        const symmetric = vm.processInput("1.[+-5]");

        // Zero fractional digits are visible, so both forms use 10^0 = 1.
        expect(relative.result.low.equals(new Rational(-2))).toBe(true);
        expect(relative.result.high.equals(new Rational(3))).toBe(true);
        expect(symmetric.result.low.equals(new Rational(-4))).toBe(true);
        expect(symmetric.result.high.equals(new Rational(6))).toBe(true);
    });
});

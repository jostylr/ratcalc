
import { expect, test, describe } from "bun:test";
import { VariableManager } from "../../../packages/algebra/src/var.js";
import { BaseSystem } from "../../../packages/core/src/base-system.js";
import { Integer } from "../../../packages/core/src/integer.js";

describe("0D Prefix Support", () => {
    const vm = new VariableManager();

    test("Decimal Mode: 0D as default", () => {
        vm.setInputBase(BaseSystem.DECIMAL);
        const res = vm.processInput("0D10 + 5");
        expect(res.type).toBe("expression");
        expect(res.result.toString()).toBe("15");
    });

    test("Hex Mode: 0D as default (16)", () => {
        vm.setInputBase(BaseSystem.HEXADECIMAL);
        const res = vm.processInput("0D10 + 5");
        expect(res.result.toString()).toBe("21");
    });

    test("Hex Mode: 0D with letters", () => {
        vm.setInputBase(BaseSystem.HEXADECIMAL);
        const res = vm.processInput("0Da + 5");
        expect(res.result.toString()).toBe("15");
    });

    test("Binary Mode: 0D as default (2)", () => {
        vm.setInputBase(BaseSystem.BINARY);
        const res = vm.processInput("0D101 + 1");
        expect(res.result.toString()).toBe("6");
    });

    test("Ambiguity Resolution with 0D", () => {
        vm.setInputBase(BaseSystem.HEXADECIMAL);
        vm.setVariable("a", new Integer(1));

        // a + 1 should be ambiguous
        const resErr = vm.processInput("a + 1");
        expect(resErr.type).toBe("error");
        expect(resErr.message).toContain("Ambiguous reference 'a'");
        expect(resErr.message).toContain("0Da");

        // 0Da + 1 should work
        const res = vm.processInput("0Da + 1");
        expect(res.result.toString()).toBe("11");
    });

    test("Case-insensitive standard prefixes", () => {
        const res = vm.processInput("0x10 + 0X10");
        expect(res.result.toString()).toBe("32");
    });

    test("Lowercase 0d stays as decimal", () => {
        vm.setInputBase(BaseSystem.HEXADECIMAL);
        const res = vm.processInput("0d10 + 1");
        expect(res.result.toString()).toBe("11");
    });
});

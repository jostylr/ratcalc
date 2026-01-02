import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Calculator } from "../index.js";

class TestCalculator extends Calculator {
    constructor() {
        const logs = [];
        super((...args) => logs.push(args.join(" ")));
        this.logs = logs;
    }

    start() { /* No-op */ }

    // Override setupReadline to avoid attaching listeners that might keep process alive or interfere
    setupReadline() { }

    close() {
        this.rl.close();
    }

    getLastLog() {
        const validLogs = this.logs.filter(l => !l.startsWith("Parser Debug"));
        if (validLogs.length === 0) return undefined;
        return validLogs[validLogs.length - 1];
    }

    clearLogs() {
        this.logs.length = 0;
    }
}

describe("Prefix Strictness and BASES Command", () => {
    let calc;

    beforeEach(() => {
        calc = new TestCalculator();
    });

    afterEach(() => {
        calc.close();
    });

    test("Strict Prefix Interpretation", () => {
        calc.runCommand("BASE 36");
        calc.clearLogs();

        // 0b10 -> Binary 2
        // If parsed as Base 36 '0b10', it would be much larger.
        // It should be strictly binary 2 because 'b' is the registered binary prefix.
        calc.runCommand("0b10");

        // Output in Base 36 of 2 is '2'
        expect(calc.getLastLog()).toMatch(/^2/);
    });

    test("BASES command linking", () => {
        calc.runCommand("BASES t:32, z:62");

        const linkedT = calc.logs.some(l => l.includes("Linked prefix '0t' to Base 32"));
        expect(linkedT).toBe(true);

        calc.clearLogs();
        calc.runCommand("0t10"); // Base 32 '10' = 32
        expect(calc.getLastLog()).toBe("32");

        calc.clearLogs();
        calc.runCommand("0z10"); // Base 62 '10' = 62
        expect(calc.getLastLog()).toBe("62");
    });

    test("Case sensitive prefixes", () => {
        calc.runCommand("BASES q:4, Q:5");

        calc.clearLogs();
        calc.runCommand("0q10"); // Base 4 '10' = 4
        expect(calc.getLastLog()).toBe("4");

        calc.clearLogs();
        calc.runCommand("0Q10"); // Base 5 '10' = 5
        expect(calc.getLastLog()).toBe("5");
    });

    test("Strictness - Unregistered Prefix", () => {
        calc.runCommand("0j10");
        expect(calc.getLastLog()).toContain("Invalid or unregistered prefix '0j'");
    });

    test("BASES with char sequence", () => {
        // A -> 01 (Base 2 using '0' and '1')
        calc.runCommand("BASES A:01");

        calc.clearLogs();
        calc.runCommand("0A10"); // Binary '10' = 2
        expect(calc.getLastLog()).toBe("2");
    });
});

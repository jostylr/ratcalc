import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Calculator } from "../index.js";

class TestCalculator extends Calculator {
    constructor() {
        const logs = [];
        super((...args) => logs.push(args.join(" ")));
        this.logs = logs;
    }
    start() { }
    setupReadline() { }
    close() { this.rl.close(); }
    getLastLog() {
        const validLogs = this.logs.filter(l => !l.startsWith("Parser Debug"));
        if (validLogs.length === 0) return undefined;
        return validLogs[validLogs.length - 1];
    }
    clearLogs() { this.logs.length = 0; }
}

describe("Calc: Custom Base Sensitivity and Sci Notation", () => {
    let calc;
    beforeEach(() => { calc = new TestCalculator(); });
    afterEach(() => { calc.close(); });

    test("Base 62 Case Sensitivity (a vs A)", () => {
        calc.runCommand("BASE 62");
        calc.clearLogs();

        // In RatMath Base 62: 0-9, a-z (10-35), A-Z (36-61)
        // 'A' should be 36
        // 'a' should be 10

        calc.runCommand("A");
        expect(calc.getLastLog()).toContain("36"); // Standard decimal output usually included or is primary

        calc.clearLogs();
        calc.runCommand("a");
        expect(calc.getLastLog()).toContain("10"); // Wait, input 'a' -> 10 in Base 62

        // Ensure they are not equal in output
        // If case insensitive, 'a' might be treated as 'A' (10) or vice versa.
    });

    test("Base 62 uses _^ for scientific notation", () => {
        calc.runCommand("BASE 62");
        calc.clearLogs();

        // 1_^2. In Base 62, this should be valid.
        // It likely means 1 * 62^2 (if base-aware) or 1 * 10^2?
        // Usually RatMath parser scientific notation uses the input base power.
        // base^exponent.
        // If it throws "wants E notation", this test will catch it.

        calc.runCommand("1_^2");

        const output = calc.getLastLog();
        expect(output).not.toContain("Error");
        expect(output).not.toContain("Expected E notation");
    });

    test("Base 32 treats E as digit and forbids E notation", () => {
        calc.runCommand("BASE 32"); // 0-9, a-v (or A-V?)
        calc.clearLogs();

        // 5E2. E is digit (14).
        // 5 * 32^2 + 14 * 32 + 2 = 5120 + 448 + 2 = 5570
        // RatMath output usually shows decimal value + representation
        calc.runCommand("5E2");
        const log = calc.getLastLog();
        expect(log).toContain("5570");

        // 5_^2. Sci notation.
        // 5 * 32^2 = 5120
        // 5_^2. Sci notation.
        // 5 * 32^2 = 5120
        calc.runCommand("5_^2");
        const logSci = calc.getLastLog();
        expect(logSci).toContain("5120");
    });

    test("HEX input handled correctly (Double Processing Fix)", () => {
        calc.runCommand("BASE 16"); // HEX
        calc.clearLogs();

        // 'a' is 10.
        // Should output 10 (decimal) or 10 (0xa).
        // Before fix: output 16 (0x10) because '10' string re-parsed as Hex.
        calc.runCommand("a");
        const log = calc.getLastLog();
        expect(log).toContain("10");
        expect(log).not.toContain("16");
    });

    test("Base 10 supports _^ by default", () => {
        calc.runCommand("BASE 10");
        calc.clearLogs();

        // 5_^2 should be 500
        calc.runCommand("5_^2");
        const log = calc.getLastLog();
        expect(log).toContain("500");
        expect(log).not.toContain("Error");
        expect(log).not.toContain("Expected E notation");
    });

    test("Scientific Notation with negative exponent works (e.g. 1_^-1)", () => {
        calc.runCommand("BASE 16");
        calc.clearLogs();

        // 1_^-1 -> 1 * 16^-1 = 1/16 = 0.0625
        calc.runCommand("1_^-1");
        const log = calc.getLastLog();
        // Check for 0.0625 OR 1/16 (RatMath might output either depending on config)
        // Usually 0.0625 (decimal) value is shown.
        // Or Hex format? 0.1?
        // But 0x0.1 is 1/16.
        // Let's expect "1/16" or "0.0625" or "0.1". 
        // AND ensuring it is NOT E-252.

        // RatMath output usually line: "<value> (<formatted>)"
        // If it parses correctly, value should be rational 1/16.
        // Assert text content to match reasonable expectations.
        const validOutputs = ["0.0625", "1/16", "0.1", "6.25E-2"];
        const matches = validOutputs.some(val => log.includes(val));

        expect(matches).toBe(true);
        expect(log).not.toContain("E-252");
    });
});

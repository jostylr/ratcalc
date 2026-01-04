
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
        // Filter out debug logs if any
        const validLogs = this.logs.filter(l => !l.startsWith("Parser Debug"));
        if (validLogs.length === 0) return undefined;
        return validLogs[validLogs.length - 1];
    }
    clearLogs() { this.logs.length = 0; }
}

describe("CLI Strictness and HOC Reproduction", () => {
    let calc;
    beforeEach(() => { calc = new TestCalculator(); });
    afterEach(() => { calc.close(); });

    test("User Scenario Check", () => {
        // > F = x->x^2
        calc.runCommand("F = x->x^2");
        expect(calc.logs.join("\n")).toContain("Function F[x] defined");
        calc.clearLogs();

        // > G = (x, A) -> A(x)*x
        calc.runCommand("G = (x, A) -> A(x)*x");
        expect(calc.logs.join("\n")).toContain("Function G[x,A] defined");
        calc.clearLogs();

        // > G(3, F)
        // Should be F(3)*3 = 9*3 = 27
        calc.runCommand("G(3, F)");
        expect(calc.getLastLog()).toContain("27");
        calc.clearLogs();

        // > G(3, 3) 
        // Should fail because A expects Function (Uppercase)
        calc.runCommand("G(3, 3)");
        const failLog = calc.getLastLog();
        // Expect error message about strict mismatch, NOT "Unexpected token"
        // User saw: "Unexpected token at end: ((0d3))*(0d3)"
        // We want to see "Argument mismatch"
        console.log("G(3,3) Output:", failLog);

        // > G(3, x->x^3)
        // Should work: x^3 -> 27. 27*3 = 81
        calc.clearLogs();
        calc.runCommand("G(3, x->x^3)");
        const successLog = calc.getLastLog();
        console.log("G(3, x->x^3) Output:", successLog);

        if (successLog.includes("Invalid rational")) {
            throw new Error("Reproduction Confirmed: Invalid rational number format");
        }
    });
});

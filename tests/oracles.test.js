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
    getAllLogs() {
        return this.logs.filter(l => !l.startsWith("Parser Debug"));
    }
    clearLogs() { this.logs.length = 0; }
    
    // Async version of runCommand for LOAD commands
    async runCommandAsync(input) {
        const upperInput = input.toUpperCase().trim();
        if (upperInput.startsWith("LOAD ")) {
            await this.handleLoadCommand(input.substring(5).trim());
            return;
        }
        this.runCommand(input);
    }
}

describe("Calc: Oracles Integration", () => {
    let calc;
    beforeEach(() => { calc = new TestCalculator(); });
    afterEach(() => { calc.close(); });

    test("LOAD oracles command works", async () => {
        await calc.runCommandAsync("LOAD oracles");
        const log = calc.getLastLog();
        expect(log).toContain("Oracles");
        expect(log).toContain("loaded");
    });

    test("Sqrt(2) creates an oracle", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("s = Sqrt(2)");
        const log = calc.getLastLog();
        // Should not contain error messages
        expect(log).not.toContain("Invalid");
        expect(log).not.toContain("Error");
        expect(log).not.toContain("Failed");
    });

    test("Sqrt(2) returns an oracle with yes interval", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("Sqrt(2)");
        const log = calc.getLastLog();
        // Should display oracle info
        expect(log).not.toContain("Invalid");
        expect(log).not.toContain("Error");
        // Oracle should display with yes interval
        expect(log).toContain("Oracle");
    });

    test("Oracle(2) creates an oracle from number", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("Oracle(2)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Invalid");
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("OracleAdd(2, 4) works with raw numbers", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("OracleAdd(2, 4)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Invalid");
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("NRoot(8, 3) computes cube root", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("NRoot(8, 3)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Invalid");
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("CFSqrt2() creates continued fraction oracle", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("CFSqrt2()");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("CFE() creates e oracle", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("CFE()");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("CFPhi() creates golden ratio oracle", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("CFPhi()");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("OracleYes returns the yes interval", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("a = Oracle(5)");
        calc.clearLogs();
        calc.runCommand("OracleYes(a)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        // Should show an interval containing 5
        expect(log).toContain("5");
    });

    test("Oracle arithmetic: OracleMul", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("OracleMul(3, 4)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("Oracle arithmetic: OracleSub", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("OracleSub(10, 3)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("Oracle arithmetic: OracleDiv", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("OracleDiv(10, 2)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("Oracle arithmetic: OracleNeg", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("OracleNeg(5)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });

    test("Assigning oracle to variable works", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("a = Sqrt(2)");
        expect(calc.getLastLog()).not.toContain("Error");
        
        calc.clearLogs();
        calc.runCommand("b = Sqrt(3)");
        expect(calc.getLastLog()).not.toContain("Error");
    });

    test("Sqrt with fraction input", async () => {
        await calc.runCommandAsync("LOAD oracles");
        calc.clearLogs();
        
        calc.runCommand("Sqrt(1/2)");
        const log = calc.getLastLog();
        expect(log).not.toContain("Invalid");
        expect(log).not.toContain("Error");
        expect(log).toContain("Oracle");
    });
});

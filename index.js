#!/usr/bin/env bun

/**
 * Terminal Calculator for ratmath
 *
 * Interactive calculator that parses mathematical expressions using the ratmath library.
 * Supports rational arithmetic, intervals, and various output formats.
 */

import { Rational, RationalInterval, Integer, BaseSystem } from "@ratmath/core";
import { VariableManager, PackageRegistry, getPackageInfo, resolveDependencies } from "@ratmath/algebra";
import { createInterface } from "readline";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { registerStdLib } from "@ratmath/stdlib";

// Package module loaders - lazy loaded when needed
const PackageLoaders = {
    reals: () => import("@ratmath/reals/src/ratmath-module.js"),
    oracles: () => import("@ratmath/oracles/src/ratmath-module.ts"),
};


class Calculator {
  constructor(logger = console.log) {
    this.log = logger;
    this.outputMode = "BOTH"; // 'DECI', 'RAT', 'BOTH', 'SCI', 'CF'
    this.decimalLimit = 20; // Maximum decimal places before showing ...
    this.mixedDisplay = true; // Whether to show fractions as mixed numbers by default
    this.sciPrecision = 10; // Scientific notation precision (significant digits)
    this.showPeriodInfo = false; // Whether to show period info in scientific notation
    this.variableManager = new VariableManager(); // Variable and function management

    this.shouldInterrupt = false; // Flag for computation interruption
    this.inputBase = BaseSystem.DECIMAL; // Base system for parsing input
    this.outputBases = [BaseSystem.DECIMAL]; // Array of base systems for displaying output
    this.customBases = new Map(); // Custom base definitions [n] = character_sequence
    this.variableManager.setCustomBases(this.customBases);

    // Register Standard Library
    registerStdLib(this.variableManager);

    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "> ",
    });

    this.setupReadline();
    this.setupInterruptHandling();
  }

  setupReadline() {
    this.rl.on("line", (input) => {
      this.processInput(input.trim());
      this.rl.prompt();
    });

    this.rl.on("close", () => {
      this.log("\nGoodbye!");
      process.exit(0);
    });
  }

  setupInterruptHandling() {
    // Handle Ctrl+C gracefully
    process.on("SIGINT", () => {
      if (this.shouldInterrupt) {
        // Already interrupting, force exit
        this.log("\nForce exit");
        process.exit(0);
      } else {
        // Set interrupt flag for ongoing computation
        this.shouldInterrupt = true;
        this.log(
          "\nInterrupting computation... (Press Ctrl+C again to force exit)",
        );
      }
    });

    // Set up progress callback for variable manager
    this.variableManager.setProgressCallback(
      (keyword, variable, current, end, accumulator, iterationCount) => {
        if (this.shouldInterrupt) {
          return false; // Stop computation
        }

        // Show progress every 10 iterations
        if (iterationCount % 10 === 0) {
          const progress = accumulator
            ? `, current: ${this.formatResult(accumulator)}`
            : "";
          process.stdout.write(
            `\r${keyword}[${variable}]: ${variable}=${current}${progress}     `,
          );
        }

        return true; // Continue computation
      },
    );
  }

  processInput(input) {
    if (!input) return;

    // Reset interrupt flag for new computation
    this.shouldInterrupt = false;

    // Check for base definition syntax: [n] = range
    const baseDefMatch = input.match(/^\[(\d+)\]\s*=\s*(.+)$/);
    if (baseDefMatch) {
      const baseNum = parseInt(baseDefMatch[1]);
      const range = baseDefMatch[2].trim();

      try {
        if (isNaN(baseNum) || baseNum < 2) {
          throw new Error("Base number must be an integer >= 2");
        }

        // Create validation BaseSystem to check the range
        const newBase = new BaseSystem(range, `Custom Base ${baseNum}`);

        if (newBase.base !== baseNum) {
          throw new Error(`Character sequence length (${newBase.base}) does not match declared base [${baseNum}]`);
        }

        this.customBases.set(baseNum, newBase);
        this.log(`Defined custom base [${baseNum}] with characters "${range}"`);
      } catch (error) {
        console.error(`Error defining base: ${error.message}`);
      }
      return;
    }

    // Handle special commands
    const upperInput = input.toUpperCase();

    if (upperInput === "HELP" || upperInput.startsWith("HELP ")) {
      this.handleHelpCommand(input);
      return;
    }

    if (upperInput.startsWith("LOAD ")) {
      this.handleLoadCommand(input.substring(5).trim());
      return;
    }

    if (upperInput.startsWith("UNLOAD ")) {
      this.handleUnloadCommand(input.substring(7).trim());
      return;
    }



    if (upperInput === "DECI") {
      this.outputMode = "DECI";
      this.log("Output mode set to decimal");
      return;
    }

    if (upperInput === "RAT") {
      this.outputMode = "RAT";
      this.log("Output mode set to rational");
      return;
    }

    if (upperInput === "BOTH") {
      this.outputMode = "BOTH";
      this.log("Output mode set to both decimal and rational");
      return;
    }

    if (upperInput === "SCI") {
      this.outputMode = "SCI";
      this.log("Output mode set to scientific notation");
      return;
    }

    if (upperInput === "CF") {
      this.outputMode = "CF";
      this.log("Output mode set to continued fraction");
      return;
    }

    if (upperInput === "MIX") {
      this.mixedDisplay = !this.mixedDisplay;
      this.log(
        `Mixed number display ${this.mixedDisplay ? "enabled" : "disabled"}`,
      );
      return;
    }

    if (upperInput.startsWith("LIMIT")) {
      const limitStr = upperInput.substring(5).trim();
      if (limitStr === "") {
        this.log(
          `Current decimal display limit: ${this.decimalLimit} digits`,
        );
      } else {
        const limit = parseInt(limitStr);
        if (isNaN(limit) || limit < 1) {
          this.log("Error: LIMIT must be a positive integer");
        } else {
          this.decimalLimit = limit;
          this.log(`Decimal display limit set to ${limit} digits`);
        }
      }
      return;
    }

    if (upperInput.startsWith("SCIPREC")) {
      const precStr = upperInput.substring(7).trim();
      if (precStr === "") {
        this.log(
          `Current scientific notation precision: ${this.sciPrecision} digits`,
        );
      } else {
        const precision = parseInt(precStr);
        if (isNaN(precision) || precision < 1) {
          this.log("Error: SCIPREC must be a positive integer");
        } else {
          this.sciPrecision = precision;
          this.log(
            `Scientific notation precision set to ${precision} digits`,
          );
        }
      }
      return;
    }

    if (upperInput === "SCIPERIOD") {
      this.showPeriodInfo = !this.showPeriodInfo;
      this.log(
        `Period info display ${this.showPeriodInfo ? "enabled" : "disabled"}`,
      );
      return;
    }

    // Handle BASE commands (but not BASES)
    if (upperInput.startsWith("BASE") && !upperInput.startsWith("BASES")) {
      this.handleBaseCommand(input);
      return;
    }

    // Handle BIN, HEX, OCT shortcuts
    if (upperInput === "BIN") {
      this.inputBase = BaseSystem.BINARY;
      this.outputBases = [BaseSystem.BINARY];
      this.variableManager.setInputBase(BaseSystem.BINARY);
      this.log("Base set to binary (base 2)");
      return;
    }

    if (upperInput === "HEX") {
      this.inputBase = BaseSystem.HEXADECIMAL;
      this.outputBases = [BaseSystem.HEXADECIMAL];
      this.variableManager.setInputBase(BaseSystem.HEXADECIMAL);
      this.log("Base set to hexadecimal (base 16)");
      return;
    }

    if (upperInput === "OCT") {
      this.inputBase = BaseSystem.OCTAL;
      this.outputBases = [BaseSystem.OCTAL];
      this.variableManager.setInputBase(BaseSystem.OCTAL);
      this.log("Base set to octal (base 8)");
      return;
    }

    if (upperInput === "DEC") {
      this.inputBase = BaseSystem.DECIMAL;
      this.outputBases = [BaseSystem.DECIMAL];
      this.variableManager.setInputBase(BaseSystem.DECIMAL);
      this.log("Base set to decimal (base 10)");
      return;
    }

    if (upperInput === "VARS") {
      this.showVariables();
      return;
    }

    if (upperInput.startsWith("BASES")) {
      const args = input.trim().substring(5).trim();
      if (args) {
        this.handleBasesCommand(args);
      } else {
        this.showBases();
      }
      return;
    }

    if (
      upperInput === "EXIT" ||
      upperInput === "QUIT" ||
      upperInput === "BYE"
    ) {
      this.rl.close();
      return;
    }

    // Check for format commands after expressions (exclude standalone BASES command)
    const formatMatch = input.match(
      /^(.*?)\s+(BASE\s+\d+|BASE\s+[a-zA-Z0-9\-]+|BIN|HEX|OCT|DEC|DECI|RAT|BOTH|SCI|CF|MIX)$/i,
    );

    if (formatMatch && formatMatch[2].toUpperCase() !== "BASES") {
      const [, expression, formatCmd] = formatMatch;

      // Process the expression first
      const varResult = this.variableManager.processInput(expression);

      // Clear any progress line if interactive
      if (process.stdout.isTTY) {
        process.stdout.write("\r" + " ".repeat(80) + "\r");
      }

      if (varResult.type === "error") {
        this.log(varResult.message);
        return;
      }

      // Display result in requested format
      if (varResult.type === "assignment" || varResult.type === "function") {
        this.log(varResult.message);
      } else {
        try {
          this.displayResultInFormat(varResult.result, formatCmd.trim());
        } catch (error) {
          this.handleError(error);
        }
      }
      return;
    }

    // Try to process with variable manager first
    const varResult = this.variableManager.processInput(input);

    if (varResult.type === "error") {
      this.log(varResult.message);
    } else if (
      varResult.type === "assignment" ||
      varResult.type === "function"
    ) {
      this.log(varResult.message);
    } else {
      // Regular expression evaluation
      try {
        this.displayResult(varResult.result);
      } catch (error) {
        this.handleError(error);
      }
    }
  }

  handleError(error) {
    if (
      error.message.includes("Division by zero") ||
      error.message.includes("Denominator cannot be zero")
    ) {
      this.log("Error: Division by zero is undefined");
    } else if (
      error.message.includes("Factorial") &&
      error.message.includes("negative")
    ) {
      this.log("Error: Factorial is not defined for negative numbers");
    } else if (
      error.message.includes("Zero cannot be raised to the power of zero")
    ) {
      this.log("Error: 0^0 is undefined");
    } else {
      this.log(`Error: ${error.message}`);
    }
  }

  // Legacy support - currentBase getter/setter for backward compatibility
  get currentBase() {
    return this.inputBase;
  }

  set currentBase(base) {
    this.inputBase = base;
    this.outputBases = [base];
    this.variableManager.setInputBase(base);
  }

  handleBaseCommand(command) {
    const parts = command.split(/\s+/);

    if (parts.length === 1) {
      // Just "BASE" - show current base configuration
      if (
        this.outputBases.length === 1 &&
        this.inputBase.equals(this.outputBases[0])
      ) {
        this.log(
          `Current base: ${this.inputBase.name} (base ${this.inputBase.base})`,
        );
      } else {
        this.log(
          `Input base: ${this.inputBase.name} (base ${this.inputBase.base})`,
        );
        this.log(
          `Output base${this.outputBases.length > 1 ? "s" : ""}: ${this.outputBases.map((b) => `${b.name} (base ${b.base})`).join(", ")}`,
        );
      }
      return;
    }

    const baseSpec = parts.slice(1).join(" ");

    // Check for input->output notation: BASE 3->10 or BASE 3->[10,5,3]
    if (baseSpec.includes("->")) {
      this.handleInputOutputBaseCommand(baseSpec);
      return;
    }

    // Legacy behavior: set both input and output to same base
    this.handleLegacyBaseCommand(baseSpec);
  }

  handleBasesCommand(args) {
    const parts = args.split(",").map(p => p.trim());
    const results = [];
    const errors = [];

    for (const part of parts) {
      if (part.includes(":")) {
        const [prefix, def] = part.split(":").map(s => s.trim());
        if (prefix.length !== 1) {
          errors.push(`Prefix '${prefix}' must be a single character`);
          continue;
        }
        try {
          const base = this.parseBaseSpec(def);
          BaseSystem.registerPrefix(prefix, base);
          results.push(`Linked prefix '0${prefix}' to ${base.name}`);
        } catch (e) {
          errors.push(`Error linking '${prefix}': ${e.message}`);
        }
      } else {
        errors.push(`Invalid format '${part}'. Use prefix:base (e.g. t:32)`);
      }
    }

    if (results.length > 0) {
      this.log(results.join("\n"));
    }
    if (errors.length > 0) {
      this.log(errors.join("\n"));
    }
  }

  handleInputOutputBaseCommand(baseSpec) {
    const [inputSpec, outputSpec] = baseSpec.split("->", 2);

    if (!inputSpec.trim() || !outputSpec.trim()) {
      this.log(
        "Error: Invalid input->output format. Use BASE 3->10 or BASE 3->[10,5,3]",
      );
      return;
    }

    // Parse input base
    try {
      this.inputBase = this.parseBaseSpec(inputSpec.trim());
      this.variableManager.setInputBase(this.inputBase);
    } catch (error) {
      this.log(`Error parsing input base: ${error.message}`);
      return;
    }

    // Parse output base(s)
    try {
      const trimmedOutput = outputSpec.trim();
      if (trimmedOutput.startsWith("[") && trimmedOutput.endsWith("]")) {
        // Multiple output bases: [10,5,3]
        const baseSpecs = trimmedOutput
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim());
        if (baseSpecs.length === 0) {
          throw new Error("Empty output base list");
        }
        this.outputBases = baseSpecs.map((spec) => this.parseBaseSpec(spec));
      } else {
        // Single output base: 10
        this.outputBases = [this.parseBaseSpec(trimmedOutput)];
      }
    } catch (error) {
      this.log(`Error parsing output base(s): ${error.message}`);
      return;
    }

    // Success message
    const outputBaseNames = this.outputBases
      .map((b) => {
        const prefix = BaseSystem.getPrefixForSystem(b);
        return prefix ? `0${prefix} (${b.name})` : `${b.name} (base ${b.base})`;
      })
      .join(", ");
    this.log(
      `Input base: ${this.inputBase.name}${BaseSystem.getPrefixForSystem(this.inputBase) ? ` (prefix 0${BaseSystem.getPrefixForSystem(this.inputBase)})` : ` (base ${this.inputBase.base})`}`,
    );
    this.log(
      `Output base${this.outputBases.length > 1 ? "s" : ""}: ${outputBaseNames}`,
    );
  }

  handleLegacyBaseCommand(baseSpec) {
    try {
      const base = this.parseBaseSpec(baseSpec);
      this.inputBase = base;
      this.outputBases = [base];
      this.variableManager.setInputBase(base);
      const prefix = BaseSystem.getPrefixForSystem(base);
      const prefixInfo = prefix ? ` (prefix 0${prefix})` : "";
      this.log(`Base set to ${base.name}${prefixInfo} (base ${base.base})`);
    } catch (error) {
      this.log(`Error: ${error.message}`);
    }
  }

  handleHelpCommand(input) {
    const args = input.trim().split(/\s+/);
    if (args.length > 1) {
      // HELP <Topic>
      const topic = args[1];
      this.log(this.variableManager.getHelp(topic));
    } else {
      this.showHelp();
    }
  }

  async handleLoadCommand(moduleInput) {
    // Split input to support multiple packages: LOAD reals units stats
    const parts = moduleInput.trim().split(/\s+/);
    
    // Collect packages to load from registry
    const registryPackages = [];
    const fileModules = [];
    
    for (const part of parts) {
      // Check if it's a registered package name
      const pkgInfo = getPackageInfo(part);
      if (pkgInfo) {
        registryPackages.push(part.toLowerCase());
      } else if (part.startsWith("@@") || existsSync(part) || existsSync(`${part}.rat`) || existsSync(`${part}.js`)) {
        fileModules.push(part);
      } else {
        this.log(`Unknown package or file: '${part}'. Type HELP packages to see available packages.`);
      }
    }
    
    // Resolve dependencies for registry packages
    if (registryPackages.length > 0) {
      const toLoad = resolveDependencies(registryPackages, this.variableManager.getLoadedPackages());
      
      for (const pkgName of toLoad) {
        await this.loadRegistryPackage(pkgName);
      }
    }
    
    // Load file-based modules
    for (const fileModule of fileModules) {
      await this.loadFileModule(fileModule);
    }
  }
  
  async loadRegistryPackage(packageName) {
    const pkgInfo = getPackageInfo(packageName);
    if (!pkgInfo) {
      this.log(`Package '${packageName}' not found in registry.`);
      return;
    }
    
    if (this.variableManager.isPackageLoaded(packageName)) {
      this.log(`Package '${pkgInfo.name}' is already loaded.`);
      return;
    }
    
    // Check if we have a loader for this package
    if (PackageLoaders[packageName]) {
      try {
        const mod = await PackageLoaders[packageName]();
        const scope = mod.default || mod;
        const result = this.variableManager.loadModule(pkgInfo.name, scope);
        this.variableManager.markPackageLoaded(packageName);
        this.log(result);
      } catch (e) {
        this.log(`Error loading package '${pkgInfo.name}': ${e.message}`);
      }
    } else {
      // Package is in registry but no loader available (stub/future package)
      this.log(`Package '${pkgInfo.name}' is not yet implemented.`);
    }
  }
  
  async loadFileModule(moduleInput) {
    try {
      let moduleName = "";
      let filePath = moduleInput;

      // Parse @@Module notation
      if (moduleInput.startsWith("@@")) {
        const name = moduleInput.substring(2).replace(/@$/, "");
        moduleName = name;
        // Look for file in current directory
        if (existsSync(`${name}.rat`)) filePath = `${name}.rat`;
        else if (existsSync(`${name}.js`)) filePath = `${name}.js`;
        else {
          this.log(`Error: Could not find file for module @@${moduleName} (checked ${name}.rat, ${name}.js)`);
          return;
        }
      } else {
        // File path provided
        if (!existsSync(filePath)) {
          this.log(`Error: File '${filePath}' not found`);
          return;
        }
        const basename = filePath.split(/[/\\]/).pop().split('.')[0];
        moduleName = basename.charAt(0).toUpperCase() + basename.slice(1);
      }

      const resolvedPath = resolve(filePath);

      if (resolvedPath.endsWith(".js")) {
        try {
          const mod = await import(resolvedPath);
          const scope = mod.default || mod;
          if (!scope.functions && !scope.variables) {
            this.log(`Warning: JS Module '${moduleName}' does not seem to export 'functions' or 'variables'.`);
          }
          const result = this.variableManager.loadModule(moduleName, scope);
          this.log(result);
        } catch (e) {
          this.log(`Error loading JS module: ${e.message}`);
        }
      } else {
        // RatMath Script Loading
        const content = readFileSync(resolvedPath, "utf-8");
        const tempVM = new VariableManager();
        tempVM.setCustomBases(this.customBases);
        tempVM.setInputBase(this.inputBase);

        const lines = content.split('\n');
        for (const line of lines) {
          if (!line.trim() || line.trim().startsWith("#") || line.trim().startsWith("//")) continue;
          try {
            const res = tempVM.processInput(line);
            if (res.type === 'error') {
              this.log(`Warning: Error in module script '${line.trim()}': ${res.message}`);
            }
          } catch (e) { }
        }

        const modScope = {
          functions: Object.fromEntries(tempVM.getFunctions()),
          variables: Object.fromEntries(tempVM.getVariables())
        };

        const result = this.variableManager.loadModule(moduleName, modScope);
        this.log(result);
      }
    } catch (error) {
      this.log(`Error handling LOAD command: ${error.message}`);
    }
  }

  handleUnloadCommand(moduleName) {
    if (moduleName.startsWith("@@")) {
      moduleName = moduleName.substring(2).replace(/@$/, "");
    }
    this.log(this.variableManager.unloadModule(moduleName));
  }


  parseBaseSpec(baseSpec) {
    const trimmed = baseSpec.trim();

    // Support inline prefix registration (e.g. t:32)
    if (trimmed.includes(":") && !trimmed.startsWith("[") && !trimmed.endsWith("]")) {
      const splitIndex = trimmed.indexOf(":");
      const prefix = trimmed.substring(0, splitIndex).trim();
      const def = trimmed.substring(splitIndex + 1).trim();

      if (prefix.length === 1) {
        try {
          const base = this.parseBaseSpec(def);
          BaseSystem.registerPrefix(prefix, base);
          return base;
        } catch (e) {
          // Fall through if it's not a valid registration
        }
      }
    }

    // 1. Check for registered prefixes (case-insensitive)
    const prefixSystem = BaseSystem.getSystemForPrefix(trimmed);
    if (prefixSystem) return prefixSystem;

    // 2. Check for common names (case-insensitive)
    const upper = trimmed.toUpperCase();
    if (upper === "HEX" || upper === "HEXADECIMAL") return BaseSystem.HEXADECIMAL;
    if (upper === "BIN" || upper === "BINARY") return BaseSystem.BINARY;
    if (upper === "OCT" || upper === "OCTAL") return BaseSystem.OCTAL;
    if (upper === "DEC" || upper === "DECIMAL") return BaseSystem.DECIMAL;

    // 3. Check if it's a pure numeric base
    // 3. Check if it's a pure numeric base
    const numericBase = parseInt(trimmed);
    // If it looks like a number AND is a valid base range (2-62), treat as base ID.
    // If it starts with 0 (e.g. 01) and length > 1, treating as char sequence takes precedence?
    // User convention: "01" is likely binary char seq. "10" is Base 10.
    const isNumericBaseId = !isNaN(numericBase) && /^\d+$/.test(trimmed) && numericBase >= 2 && numericBase <= 62 && !trimmed.startsWith("0");

    if (isNumericBaseId) {
      if (this.customBases.has(numericBase)) {
        return this.customBases.get(numericBase);
      }
      return BaseSystem.fromBase(numericBase);
    }

    // If strictly numeric but failed above (e.g. 1, 01, 70), or non-numeric:
    // Try as character sequence.
    if (trimmed.length >= 2) {
      return new BaseSystem(trimmed, `Custom Base ${trimmed}`);
    }

    throw new Error(
      "Invalid base specification. Use a prefix, a number (2-62), or character sequence (min length 2)",
    );
  }

  displayResultInFormat(result, formatCmd) {
    const upperFormat = formatCmd.toUpperCase();

    if (upperFormat === "MIX") {
      const oldMixed = this.mixedDisplay;
      this.mixedDisplay = !this.mixedDisplay;
      this.displayResult(result);
      this.mixedDisplay = oldMixed;
    } else if (upperFormat === "DECI") {
      const oldMode = this.outputMode;
      this.outputMode = "DECI";
      this.displayResult(result);
      this.outputMode = oldMode;
    } else if (upperFormat === "RAT") {
      const oldMode = this.outputMode;
      this.outputMode = "RAT";
      this.displayResult(result);
      this.outputMode = oldMode;
    } else if (upperFormat === "BOTH") {
      const oldMode = this.outputMode;
      this.outputMode = "BOTH";
      this.displayResult(result);
      this.outputMode = oldMode;
    } else if (upperFormat === "SCI") {
      const oldMode = this.outputMode;
      this.outputMode = "SCI";
      this.displayResult(result);
      this.outputMode = oldMode;
    } else if (upperFormat === "CF") {
      const oldMode = this.outputMode;
      this.outputMode = "CF";
      this.displayResult(result);
      this.outputMode = oldMode;
    } else if (upperFormat.startsWith("BASE")) {
      // Handle base format commands
      const baseSpec = upperFormat.substring(4).trim();
      try {
        const targetBase = this.parseBaseSpec(baseSpec);
        this.displayResultInBase(result, targetBase);
      } catch (e) {
        this.log(`Error: ${e.message}`);
      }
    } else if (upperFormat === "BIN") {
      this.displayResultInBase(result, BaseSystem.BINARY);
    } else if (upperFormat === "HEX") {
      this.displayResultInBase(result, BaseSystem.HEXADECIMAL);
    } else if (upperFormat === "OCT") {
      this.displayResultInBase(result, BaseSystem.OCTAL);
    } else if (upperFormat === "DEC") {
      this.displayResultInBase(result, BaseSystem.DECIMAL);
    }
  }

  displayResultInBase(result, baseSystem) {
    const prefix = BaseSystem.getPrefixForSystem(baseSystem);
    const displayPrefix = prefix ? `0${prefix}` : "";

    if (result instanceof Integer) {
      const baseRepr = baseSystem.fromDecimal(result.value);
      if (displayPrefix) {
        this.log(`${displayPrefix}${baseRepr}`);
      } else {
        this.log(`${baseRepr} (base ${baseSystem.base})`);
      }
    } else if (result instanceof Rational) {
      const baseRepr = result.toString(baseSystem);
      if (displayPrefix) {
        this.log(`${displayPrefix}${baseRepr}`);
      } else {
        this.log(`${baseRepr} (base ${baseSystem.base})`);
      }
    } else {
      this.log("Base conversion not supported for this result type");
    }
  }

  showBases() {
    this.log("\nAvailable base systems:");
    this.log("Standard bases:");
    this.log("  Binary (BIN):       base b:2");
    this.log("  Octal (OCT):        base o:8");
    this.log("  Decimal (DEC):      base d:10");
    this.log("  Hexadecimal (HEX):  base x:16");
    this.log("  Base 36:            base 36");
    this.log("  Base 62:            base 62");
    this.log("\n  Prefix 0D is reserved for the current default input base.");
    this.log("\nBase commands:");
    this.log("  BASE                - Show current base");
    this.log("  BASE <n>            - Set base to n (2-62)");
    this.log("  BASE <a:n>          - Set base to n (2-62) and prefx a (a-Z) ");
    this.log("  BASES <a:n> ...     - Link a to n (2-62) as prefix, etc ");
    this.log(
      "  BASE <sequence>     - Set custom base using character sequence",
    );
    this.log(
      "  BASE <in>-><out>    - Set input base <in> and output base <out>",
    );
    this.log(
      "  BASE <in>->[<out1>,<out2>,...] - Set input base and multiple output bases",
    );
    this.log("  BIN, HEX, OCT, DEC  - Quick base shortcuts");
    this.log("  BASES               - Show this help");
    this.log("\nBase format commands (after expressions):");
    this.log("  <expr> BASE <n>     - Show result in base n");
    this.log("  <expr> BIN          - Show result in binary");
    this.log("  <expr> HEX          - Show result in hexadecimal");
    this.log("  <expr> OCT          - Show result in octal");
    this.log(
      `\nInput base: ${this.inputBase.name} (base ${this.inputBase.base})`,
    );
    this.log(
      `Output base${this.outputBases.length > 1 ? "s" : ""}: ${this.outputBases.map((b) => `${b.name} (base ${b.base})`).join(", ")}`,
    );
    this.log("\nType 'HELP <command>' or 'HELP <function>' for more info.");
  }

  displayResult(result) {
    // Handle Promises (async results from oracles, etc.)
    if (result && typeof result.then === 'function') {
      this.log("Computing...");
      result.then((resolved) => {
        this.displayResult(resolved);
        this.rl.prompt();
      }).catch((error) => {
        this.handleError(error);
        this.rl.prompt();
      });
      return;
    }

    if (result && result.type === "string") {
      // Display strings directly, respecting newlines
      this.log(result.value);
    } else if (result && result.type === "sequence") {
      this.log(this.formatResult(result));
    } else if (result instanceof RationalInterval) {
      this.displayInterval(result);
    } else if (result instanceof Rational) {
      this.displayRational(result);
    } else if (result instanceof Integer) {
      this.displayInteger(result);
    } else if (result && typeof result === 'function' && result.yes) {
      // Oracle - display its yes interval
      this.log(`[Oracle] yes: ${result.yes.toString()}`);
    } else {
      this.log(result.toString());
    }
  }

  displayInteger(integer) {
    // Convert Integer to Rational for consistent formatting
    const rational = new Rational(integer.value, 1n);
    this.displayRational(rational);
  }

  displayRational(rational) {
    const repeatingInfo = rational.toRepeatingDecimalWithPeriod();
    const repeatingDecimal = repeatingInfo.decimal;
    const period = repeatingInfo.period;
    const decimal = this.formatDecimal(rational);
    const fraction = this.mixedDisplay
      ? rational.toMixedString()
      : rational.toString();

    // Format the decimal representation, respecting truncation limits
    const displayDecimal = this.formatRepeatingExpansion(repeatingDecimal);

    // Add period information for true repeating decimals (period > 0)
    const periodInfo =
      period === -1
        ? " [period > 10^7]"
        : period > 0
          ? ` {period: ${period}}`
          : "";

    // Show base representations if not all decimal
    let baseRepresentation = "";
    if (this.outputBases.some((base) => base.base !== 10)) {
      const baseReprs = [];
      for (const base of this.outputBases) {
        if (base.base !== 10) {
          try {
            const { baseStr, period: basePeriod } =
              rational.toRepeatingBaseWithPeriod(base);
            const formattedBaseStr = this.formatRepeatingExpansion(baseStr);
            const basePeriodInfo =
              basePeriod === -1
                ? " [period > 10^6]"
                : basePeriod > 0
                  ? ` {period: ${basePeriod}}`
                  : "";
            const prefix = BaseSystem.getPrefixForSystem(base);
            const formattedOutput = prefix
              ? `0${prefix}${formattedBaseStr}`
              : `${formattedBaseStr}[${base.base}]`;
            baseReprs.push(`${formattedOutput}${basePeriodInfo}`);
          } catch (error) {
            // Ignore conversion errors for individual bases
          }
        }
      }
      if (baseReprs.length > 0) {
        baseRepresentation = ` (${baseReprs.join(", ")})`;
      }
    }

    switch (this.outputMode) {
      case "DECI":
        this.log(`${displayDecimal}${periodInfo}${baseRepresentation}`);
        break;
      case "RAT":
        this.log(`${fraction}${baseRepresentation}`);
        break;
      case "BOTH":
        if (fraction.includes("/") || fraction.includes("..")) {
          this.log(
            `${displayDecimal}${periodInfo} (${fraction})${baseRepresentation}`,
          );
        } else {
          this.log(`${decimal}${baseRepresentation}`);
        }
        break;
      case "SCI":
        const scientificNotation = rational.toScientificNotation(
          true,
          this.sciPrecision,
          this.showPeriodInfo,
        );
        this.log(`${scientificNotation} (${fraction})${baseRepresentation}`);
        break;
      case "CF":
        const continuedFraction = rational.toContinuedFractionString();
        this.log(`${continuedFraction} (${fraction})${baseRepresentation}`);
        break;
    }
  }

  formatDecimal(rational) {
    const decimal = rational.toDecimal();
    if (decimal.length > this.decimalLimit + 2) {
      // +2 for potential "0."
      const dotIndex = decimal.indexOf(".");
      if (
        dotIndex !== -1 &&
        decimal.length - dotIndex - 1 > this.decimalLimit
      ) {
        return decimal.substring(0, dotIndex + this.decimalLimit + 1) + "...";
      }
    }
    return decimal;
  }

  formatRepeatingExpansion(expansion) {
    // If no repeating part (#), return as is or truncate if too long
    if (!expansion.includes("#")) {
      if (expansion.length > this.decimalLimit + 2) {
        const dotIndex = expansion.indexOf(".");
        if (
          dotIndex !== -1 &&
          expansion.length - dotIndex - 1 > this.decimalLimit
        ) {
          return expansion.substring(0, dotIndex + this.decimalLimit + 1) + "...";
        }
      }
      return expansion;
    }

    // Check if it's a terminating decimal (ends with #0)
    if (expansion.endsWith("#0")) {
      const withoutRepeating = expansion.substring(0, expansion.length - 2);
      // If the terminating part exceeds limit, truncate it
      if (withoutRepeating.length > this.decimalLimit + 2) {
        const dotIndex = withoutRepeating.indexOf(".");
        if (
          dotIndex !== -1 &&
          withoutRepeating.length - dotIndex - 1 > this.decimalLimit
        ) {
          return (
            withoutRepeating.substring(0, dotIndex + this.decimalLimit + 1) +
            "..."
          );
        }
      }
      return withoutRepeating;
    }

    // Check if the total length exceeds limit
    if (expansion.length > this.decimalLimit + 2) {
      // +2 for potential "0."
      const hashIndex = expansion.indexOf("#");
      const beforeHash = expansion.substring(0, hashIndex);
      const afterHash = expansion.substring(hashIndex + 1);

      // If the non-repeating part alone exceeds limit, truncate it
      if (beforeHash.length > this.decimalLimit + 1) {
        return beforeHash.substring(0, this.decimalLimit + 1) + "...";
      }

      // If adding some of the repeating part would exceed limit, truncate
      const remainingSpace = this.decimalLimit + 2 - beforeHash.length;
      if (remainingSpace <= 1) {
        return beforeHash + "#...";
      } else if (afterHash.length > remainingSpace - 1) {
        return (
          beforeHash + "#" + afterHash.substring(0, remainingSpace - 1) + "..."
        );
      }
    }

    return expansion;
  }

  displayInterval(interval) {
    const lowRepeatingInfo = interval.low.toRepeatingDecimalWithPeriod();
    const highRepeatingInfo = interval.high.toRepeatingDecimalWithPeriod();
    const lowRepeating = lowRepeatingInfo.decimal;
    const highRepeating = highRepeatingInfo.decimal;
    const lowPeriod = lowRepeatingInfo.period;
    const highPeriod = highRepeatingInfo.period;
    const lowDecimal = this.formatDecimal(interval.low);
    const highDecimal = this.formatDecimal(interval.high);
    const lowFraction = interval.low.toString();
    const highFraction = interval.high.toString();

    // For intervals, remove #0 notation since rounding is implicit
    const lowIsTerminating = lowRepeating.endsWith("#0");
    const highIsTerminating = highRepeating.endsWith("#0");
    const lowDisplay = lowIsTerminating
      ? lowRepeating.substring(0, lowRepeating.length - 2)
      : this.formatRepeatingExpansion(lowRepeating);
    const highDisplay = highIsTerminating
      ? highRepeating.substring(0, highRepeating.length - 2)
      : this.formatRepeatingExpansion(highRepeating);

    // Add period information for intervals with repeating endpoints
    let periodInfo = "";
    if (lowPeriod !== 0 || highPeriod !== 0) {
      const periodParts = [];
      if (lowPeriod === -1) periodParts.push("low: > 10^7");
      else if (lowPeriod > 0) periodParts.push(`low: ${lowPeriod}`);
      if (highPeriod === -1) periodParts.push("high: > 10^7");
      else if (highPeriod > 0) periodParts.push(`high: ${highPeriod}`);
      if (periodParts.length > 0) {
        periodInfo = ` {period: ${periodParts.join(", ")}}`;
      }
    }

    // Show base representations if not all decimal
    let baseRepresentation = "";
    if (this.outputBases.some((base) => base.base !== 10)) {
      const baseReprs = [];
      for (const base of this.outputBases) {
        if (base.base !== 10) {
          try {
            const { baseStr: lowStr } =
              interval.low.toRepeatingBaseWithPeriod(base);
            const { baseStr: highStr } =
              interval.high.toRepeatingBaseWithPeriod(base);

            const lowFormatted = this.formatRepeatingExpansion(lowStr);
            const highFormatted = this.formatRepeatingExpansion(highStr);

            const prefix = BaseSystem.getPrefixForSystem(base);
            const lowOutput = prefix ? `0${prefix}${lowFormatted}` : `${lowFormatted}[${base.base}]`;
            const highOutput = prefix ? `0${prefix}${highFormatted}` : `${highFormatted}[${base.base}]`;

            baseReprs.push(`${lowOutput}:${highOutput}`);
          } catch (error) {
            // Ignore conversion errors
          }
        }
      }
      if (baseReprs.length > 0) {
        baseRepresentation = ` (${baseReprs.join(", ")})`;
      }
    }


    switch (this.outputMode) {
      case "DECI":
        this.log(`${lowDisplay}:${highDisplay}${periodInfo}${baseRepresentation}`);
        break;
      case "RAT":
        this.log(`${lowFraction}:${highFraction}${baseRepresentation}`);
        break;
      case "BOTH":
        const decimalRange = `${lowDisplay}:${highDisplay}${periodInfo}`;
        const rationalRange = `${lowFraction}:${highFraction}`;
        if (decimalRange !== rationalRange) {
          this.log(`${decimalRange} (${rationalRange})${baseRepresentation}`);
        } else {
          this.log(`${decimalRange}${baseRepresentation}`);
        }
        break;
    }
  }

  showHelp() {
    this.log(`
RatCalc Terminal

BASIC ARITHMETIC:
  +, -, *, /        Basic operations
  ^                 Exponentiation (standard)
  **                Multiplicative exponentiation (interval)
  !                 Factorial
  !!                Double factorial
  ( )               Parentheses for grouping

NUMBERS:
  123               Integers
  3/4               Fractions
  1.25              Decimals
  1..2/3            Mixed numbers (1 and 2/3)
  0.#3              Repeating decimals (0.333...)
  1.23[+-0.01]      Decimals with uncertainty
  1.2[3,6]          Decimal concatenation (1.23:1.26)
  12[34,42]         Integer concatenation (1234:1242)
  2:5               Intervals (from 2 to 5)
  1E3, 2.5E-2       Scientific notation
  3.~7~15~1         Continued fraction (355/113)

EXAMPLES:
  1/2 + 3/4         → 5/4 (1.25)
  2^3               → 8
  5!                → 120
  1:2 * 3:4         → 3:8 (interval arithmetic)
  0.#3              → 1/3
  1.5[+-1]        → 1.49:1.51
  1.5[+10,-0.1]        → 1.499:1.6
  1.2[3,6]          → 1.23:1.26 (decimal concatenation)
  12[15,18]         → 1215:1218 (integer concatenation)
  3.~7~15~1         → 355/113 (continued fraction)

CONCATENATION RULES:
  Valid:   12[34,42] → 1234:1242 (integer parts: 34,42 both 2 digits)
  Valid:   1[19.2,20] → 119.2:120 (integer parts: 19,20 both 2 digits)
  Valid:   1.2[3,6]  → 1.23:1.26 (decimal base allows any)
  Invalid: 1[9,20] (integer parts: 9=1 digit, 20=2 digits)
  Invalid: 1[9.2,20] (integer parts: 9=1 digit, 20=2 digits)
  Invalid: 1.2[3.4,5.6] (double decimal points)

VARIABLES & FUNCTIONS:
  x = 5             Assign value (uppercase names reserved for functions)
  P(x,y) -> x^2 - y Define function (using -> syntax)
  P(3,4)            Call function with arguments
  SUM[i](i^2,1,10)  Sum expression from i=1 to 10
  PROD[j](j,1,5)    Product expression from j=1 to 5
  SEQ[k](k^3,0,5,2) Sequence expression from k=0 to 5 step 2

COMMANDS:
  HELP              Show this help
  HELP <topic>      Show help for function or package
  HELP packages     List available packages
  LOAD <package>    Load a package (e.g., LOAD reals)
  LOAD <p1> <p2>    Load multiple packages at once
  LOAD <file>       Load a module from file (.rat or .js)
  UNLOAD <module>   Unload a module
  VARS              Show defined variables and functions
  BASES             Show available base systems
  DECI              Show results as decimals only
  RAT               Show results as fractions only
  BOTH              Show both decimal and fraction (default)
  SCI               Show results in scientific notation
  CF                Show results as continued fractions
  MIX               Toggle mixed number display (default: on)
  LIMIT <n>         Set decimal display limit to n digits (default: 20)
  SCIPREC <n>       Set scientific notation precision to n digits (default: 10)
  SCIPERIOD         Toggle period info display in scientific notation
  LIMIT             Show current decimal display limit
  EXIT, QUIT, BYE   Exit calculator

BASE COMMANDS:
  BASE              Show current base system
  BASE <n>          Set base to n (2-62, e.g. BASE 16 for hex)
  BASE <prefix>:<n> Define prefix for base (e.g. BASE t:12)
  BASE <in>-><out>  Set input and output bases (supports prefixes)
  BASE <chars>      Set custom base by characters (e.g. BASE 012345)
  BIN, HEX, OCT     Quick shortcuts for binary, hex, octal
  DEC               Return to decimal (base 10)

FORMAT AFTER EXPRESSIONS:
  <expr> BASE <n>   Show result in specified base
  <expr> BIN        Show result in binary
  <expr> HEX        Show result in hexadecimal
  <expr> OCT        Show result in octal
  <expr> DECI       Show result in decimal format
  <expr> RAT        Show result in rational format
  <expr> CF         Show result as continued fraction
  <expr> MIX        Show result with mixed numbers toggled

DECIMAL DISPLAY:
  Uses repeating notation (0.#3 for 1/3) when possible
  Long decimals truncated with ... after LIMIT digits

Press Ctrl+C to exit
`);
  }

  showVariables() {
    const variables = this.variableManager.getVariables();
    const functions = this.variableManager.getFunctions();

    if (variables.size === 0 && functions.size === 0) {
      this.log("No variables or functions defined");
      return;
    }

    if (variables.size > 0) {
      this.log("Variables:");
      for (const [name, value] of variables) {
        this.log(`  ${name} = ${this.formatResult(value)}`);
      }
    }

    if (functions.size > 0) {
      if (variables.size > 0) this.log("");
      this.log("Functions:");
      for (const [name, func] of functions) {
        this.log(`  ${name}[${func.params.join(",")}] = ${func.expression}`);
      }
    }
  }

  formatResult(result) {
    if (result && result.type === "sequence") {
      return this.variableManager.formatValue(result);
    } else if (result instanceof RationalInterval) {
      return this.formatInterval(result);
    } else if (result instanceof Rational) {
      return this.formatRational(result);
    } else if (result instanceof Integer) {
      // Convert Integer to Rational for consistent formatting
      const rational = new Rational(result.value, 1n);
      return this.formatRational(rational);
    } else {
      return result.toString();
    }
  }

  formatRational(rational) {
    const fraction = this.mixedDisplay
      ? rational.toMixedString()
      : rational.toString();

    switch (this.outputMode) {
      case "DECI":
        return this.formatRepeatingExpansion(rational.toRepeatingDecimal());
      case "RAT":
        return fraction;
      case "BOTH":
        if (fraction.includes("/") || fraction.includes("..")) {
          const decimal = this.formatRepeatingExpansion(
            rational.toRepeatingDecimal(),
          );
          return `${decimal} (${fraction})`;
        } else {
          return this.formatDecimal(rational);
        }
      case "SCI":
        return rational.toScientificNotation(
          true,
          this.sciPrecision,
          this.showPeriodInfo,
        );
      case "CF":
        return rational.toContinuedFractionString();
      default:
        return fraction;
    }
  }

  formatInterval(interval) {
    const low = this.formatRational(interval.low);
    const high = this.formatRational(interval.high);
    return `${low}:${high}`;
  }

  async start() {
    this.log("RatCalc Terminal");
    this.log("Type HELP for help, EXIT to quit");
    this.log("");

    // Check for config file in current directory
    if (existsSync("ratmath.config.rat")) {
      this.log("Loading configuration from ratmath.config.rat...");
      await this.handleLoadCommand("ratmath.config.rat");
    } else if (existsSync("ratmath.config.js")) {
      this.log("Loading configuration from ratmath.config.js...");
      await this.handleLoadCommand("ratmath.config.js");
    }

    // Check CLI args for --load
    // argv[0] is bun, argv[1] is script/file
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--load' && args[i + 1]) {
        const file = args[i + 1];
        await this.handleLoadCommand(file);
        i++;
      }
    }

    this.rl.prompt();
  }

  runCommand(input) {
    if (input.trim()) {
      this.processInput(input);
    }
  }
}

// Check if running directly
if (import.meta.main) {
  const calc = new Calculator();
  calc.start();
}

export { Calculator };

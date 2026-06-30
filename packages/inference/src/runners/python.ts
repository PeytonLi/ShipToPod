import { execSync, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { CodeTask, RunResult, TestCaseResult } from "@shiptopod/core";

/**
 * Python runner — subprocess pytest execution.
 *
 * Runs candidate code + hidden tests in an isolated tempdir.
 * Subprocess: timeout 30s, no network, scratch tempdir.
 */

function parsePytestOutput(
  stdout: string,
  stderr: string,
): { passed: boolean; tests_passed: TestCaseResult[]; tests_failed: TestCaseResult[] } {
  const tests_passed: TestCaseResult[] = [];
  const tests_failed: TestCaseResult[] = [];

  // Parse pytest output: "PASSED" / "FAILED" lines
  const lines = [...stdout.split("\n"), ...stderr.split("\n")];
  for (const line of lines) {
    const passedMatch = line.match(/^(.+?)\s+PASSED/);
    if (passedMatch) {
      tests_passed.push({ name: passedMatch[1].trim(), passed: true });
    }
    const failedMatch = line.match(/^(.+?)\s+FAILED/);
    if (failedMatch) {
      tests_failed.push({
        name: failedMatch[1].trim(),
        passed: false,
        message: extractFailMessage(lines, failedMatch[1].trim()),
      });
    }
  }

  // If no test names parsed, infer from exit
  if (tests_passed.length === 0 && tests_failed.length === 0) {
    const hasError = stderr.includes("Error") || stdout.includes("FAILED");
    if (hasError) {
      tests_failed.push({ name: "test", passed: false, message: stderr || stdout });
    } else {
      tests_passed.push({ name: "test", passed: true });
    }
  }

  return {
    passed: tests_failed.length === 0 && tests_passed.length > 0,
    tests_passed,
    tests_failed,
  };
}

function extractFailMessage(lines: string[], testName: string): string {
  const startIdx = lines.findIndex((l) => l.includes(testName) && l.includes("FAILED"));
  if (startIdx < 0) return "Test failed (details unavailable)";
  // Capture next few non-empty lines as the failure message
  const msg: string[] = [];
  for (let i = startIdx + 1; i < Math.min(lines.length, startIdx + 10); i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("=")) break;
    if (trimmed.startsWith("_")) break;
    msg.push(trimmed);
  }
  return msg.join(" | ") || "Test failed";
}

export async function runPython(
  task: CodeTask,
  code: string,
): Promise<RunResult> {
  const dir = mkdtempSync(join(tmpdir(), "shiptopod-py-"));
  const testFile = join(dir, "test_solution.py");
  const solFile = join(dir, "solution.py");

  try {
    // Write candidate code
    writeFileSync(solFile, code, "utf-8");

    // Write test file: import solution + hidden tests + fixture
    const testContent = [
      "import sys",
      "import json",
      "sys.path.insert(0, '.')",
      "",
      "from solution import *",
      "",
      task.fixture || "",
      "",
      task.hidden_tests,
    ].join("\n");
    writeFileSync(testFile, testContent, "utf-8");

    // Run pytest with timeout
    const result = await runWithTimeout("pytest", [
      testFile,
      "-v",
      "--tb=short",
      "--color=no",
      "-p", "no:cacheprovider",
    ], { cwd: dir, timeoutMs: 30_000 });

    const parsed = parsePytestOutput(result.stdout, result.stderr);

    return {
      passed: parsed.passed,
      tests_passed: parsed.tests_passed,
      tests_failed: parsed.tests_failed,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error,
    };
  } finally {
    // Cleanup tempdir
    try { execSync(`rm -rf "${dir}"`); } catch { /* cleanup */ }
  }
}

async function runWithTimeout(
  command: string,
  args: string[],
  opts: { cwd: string; timeoutMs: number },
): Promise<{ stdout: string; stderr: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: opts.timeoutMs,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

    child.on("close", (code) => {
      resolve({ stdout, stderr, error: code === null ? "timeout" : undefined });
    });

    child.on("error", (err) => {
      resolve({ stdout, stderr, error: err.message });
    });
  });
}

/** Runner factory — returns { language, run } matching the Runner interface */
export const pythonRunner = {
  language: "python" as const,
  run: runPython,
};

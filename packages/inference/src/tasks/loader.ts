import type { CodeTask } from "@shiptopod/core";
import { randomUUID } from "node:crypto";

/**
 * Inline benchmark tasks (MBPP-style Python + Spider-style SQL).
 * Embedded for zero-dependency bootstrapping.
 * Full benchmarks can be loaded from files or Bright Data scraping later.
 */

export const EVAL_SPLIT_SIZE = 0.2;

/* ------------------------------------------------------------------ */
/* Python tasks (MBPP / HumanEval style)                                */
/* ------------------------------------------------------------------ */

const PYTHON_TASKS: Omit<CodeTask, "id">[] = [
  {
    prompt:
      "Write a function is_even(n) that returns True if n is even, False otherwise.",
    language: "python",
    hidden_tests: [
      "def test_is_even():",
      "    assert is_even(2) == True",
      "    assert is_even(3) == False",
      "    assert is_even(0) == True",
      "    assert is_even(-4) == True",
    ].join("\n"),
    source: "mbpp",
  },
  {
    prompt:
      "Write a function factorial(n) that returns the factorial of a non-negative integer n.",
    language: "python",
    hidden_tests: [
      "def test_factorial():",
      "    assert factorial(0) == 1",
      "    assert factorial(1) == 1",
      "    assert factorial(5) == 120",
    ].join("\n"),
    source: "mbpp",
  },
  {
    prompt:
      "Write a function reverse_string(s) that returns the reversed string.",
    language: "python",
    hidden_tests: [
      "def test_reverse_string():",
      "    assert reverse_string('hello') == 'olleh'",
      "    assert reverse_string('') == ''",
      "    assert reverse_string('a') == 'a'",
    ].join("\n"),
    source: "humaneval",
  },
  {
    prompt:
      "Write a function count_vowels(s) that returns the number of vowels (a,e,i,o,u) in a string, case-insensitive.",
    language: "python",
    hidden_tests: [
      "def test_count_vowels():",
      "    assert count_vowels('hello') == 2",
      "    assert count_vowels('HELLO') == 2",
      "    assert count_vowels('xyz') == 0",
      "    assert count_vowels('') == 0",
    ].join("\n"),
    source: "mbpp",
  },
  {
    prompt:
      "Write a function fibonacci(n) that returns the nth Fibonacci number (0-indexed: fib(0)=0, fib(1)=1).",
    language: "python",
    hidden_tests: [
      "def test_fibonacci():",
      "    assert fibonacci(0) == 0",
      "    assert fibonacci(1) == 1",
      "    assert fibonacci(5) == 5",
      "    assert fibonacci(10) == 55",
    ].join("\n"),
    source: "humaneval",
  },
  {
    prompt:
      "Write a function is_palindrome(s) that returns True if s reads the same forward and backward, ignoring case and non-alphanumeric chars.",
    language: "python",
    hidden_tests: [
      "def test_is_palindrome():",
      "    assert is_palindrome('racecar') == True",
      "    assert is_palindrome('A man a plan a canal Panama') == True",
      "    assert is_palindrome('hello') == False",
      "    assert is_palindrome('') == True",
    ].join("\n"),
    source: "mbpp",
  },
  {
    prompt:
      "Write a function merge_sorted(a, b) that takes two sorted lists and returns a single merged sorted list.",
    language: "python",
    hidden_tests: [
      "def test_merge_sorted():",
      "    assert merge_sorted([1,3,5], [2,4,6]) == [1,2,3,4,5,6]",
      "    assert merge_sorted([], [1]) == [1]",
      "    assert merge_sorted([1], []) == [1]",
    ].join("\n"),
    source: "humaneval",
  },
  {
    prompt:
      "Write a function binary_search(arr, target) that returns the index of target in a sorted array, or -1 if not found.",
    language: "python",
    hidden_tests: [
      "def test_binary_search():",
      "    assert binary_search([1,2,3,4,5], 3) == 2",
      "    assert binary_search([1,2,3,4,5], 1) == 0",
      "    assert binary_search([1,2,3,4,5], 6) == -1",
      "    assert binary_search([], 1) == -1",
    ].join("\n"),
    source: "humaneval",
  },
  {
    prompt:
      "Write a function flatten(nested) that flattens a list of arbitrarily nested lists into a single flat list.",
    language: "python",
    hidden_tests: [
      "def test_flatten():",
      "    assert flatten([1, [2, [3, 4], 5]]) == [1, 2, 3, 4, 5]",
      "    assert flatten([]) == []",
      "    assert flatten([1, 2, 3]) == [1, 2, 3]",
    ].join("\n"),
    source: "mbpp",
  },
  {
    prompt:
      "Write a function gcd(a, b) that returns the greatest common divisor of two non-negative integers.",
    language: "python",
    hidden_tests: [
      "def test_gcd():",
      "    assert gcd(48, 18) == 6",
      "    assert gcd(17, 13) == 1",
      "    assert gcd(100, 10) == 10",
    ].join("\n"),
    source: "humaneval",
  },
];

/* ------------------------------------------------------------------ */
/* SQL tasks (Spider / WikiSQL style)                                   */
/* ------------------------------------------------------------------ */

const SQL_TASKS: Omit<CodeTask, "id">[] = [
  {
    prompt:
      "Write a SELECT query to find all employees in the Engineering department. Return name and salary.",
    language: "sql",
    fixture: [
      "CREATE TABLE employees (id INT, name TEXT, department TEXT, salary INT);",
      "INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 90000);",
      "INSERT INTO employees VALUES (2, 'Bob', 'Sales', 70000);",
      "INSERT INTO employees VALUES (3, 'Carol', 'Engineering', 95000);",
      "INSERT INTO employees VALUES (4, 'Dave', 'Marketing', 65000);",
    ].join("\n"),
    hidden_tests: [
      "-- TEST: engineering_employees",
      "SELECT name, salary FROM employees WHERE department = 'Engineering' ORDER BY name;",
      '-- EXPECTED: [{"name":"Alice","salary":90000},{"name":"Carol","salary":95000}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find the average salary per department. Return department and avg_salary.",
    language: "sql",
    fixture: [
      "CREATE TABLE employees (id INT, name TEXT, department TEXT, salary INT);",
      "INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 90000);",
      "INSERT INTO employees VALUES (2, 'Bob', 'Sales', 70000);",
      "INSERT INTO employees VALUES (3, 'Carol', 'Engineering', 95000);",
      "INSERT INTO employees VALUES (4, 'Dave', 'Marketing', 65000);",
      "INSERT INTO employees VALUES (5, 'Eve', 'Sales', 75000);",
    ].join("\n"),
    hidden_tests: [
      "-- TEST: avg_salary_by_dept",
      "SELECT department, AVG(salary) as avg_salary FROM employees GROUP BY department ORDER BY avg_salary DESC;",
      '-- EXPECTED: [{"department":"Engineering","avg_salary":92500},{"department":"Sales","avg_salary":72500},{"department":"Marketing","avg_salary":65000}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find the employee(s) with the highest salary.",
    language: "sql",
    fixture: [
      "CREATE TABLE employees (id INT, name TEXT, department TEXT, salary INT);",
      "INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 90000);",
      "INSERT INTO employees VALUES (2, 'Bob', 'Sales', 70000);",
      "INSERT INTO employees VALUES (3, 'Carol', 'Engineering', 95000);",
    ].join("\n"),
    hidden_tests: [
      "-- TEST: highest_paid",
      "SELECT name, salary FROM employees WHERE salary = (SELECT MAX(salary) FROM employees) ORDER BY name;",
      '-- EXPECTED: [{"name":"Carol","salary":95000}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to count how many employees are in each department. Return department and count.",
    language: "sql",
    fixture: [
      "CREATE TABLE employees (id INT, name TEXT, department TEXT, salary INT);",
      "INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 90000);",
      "INSERT INTO employees VALUES (2, 'Bob', 'Sales', 70000);",
      "INSERT INTO employees VALUES (3, 'Carol', 'Engineering', 95000);",
      "INSERT INTO employees VALUES (4, 'Dave', 'Marketing', 65000);",
    ].join("\n"),
    hidden_tests: [
      "-- TEST: count_by_dept",
      "SELECT department, COUNT(*) as count FROM employees GROUP BY department ORDER BY department;",
      '-- EXPECTED: [{"department":"Engineering","count":2},{"department":"Marketing","count":1},{"department":"Sales","count":1}]',
    ].join("\n"),
    source: "wikisql",
  },
  {
    prompt:
      "Write a SELECT query to list employees whose salary is above the company average.",
    language: "sql",
    fixture: [
      "CREATE TABLE employees (id INT, name TEXT, department TEXT, salary INT);",
      "INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 90000);",
      "INSERT INTO employees VALUES (2, 'Bob', 'Sales', 70000);",
      "INSERT INTO employees VALUES (3, 'Carol', 'Engineering', 95000);",
      "INSERT INTO employees VALUES (4, 'Dave', 'Marketing', 65000);",
      "INSERT INTO employees VALUES (5, 'Eve', 'Sales', 75000);",
    ].join("\n"),
    hidden_tests: [
      "-- TEST: above_avg",
      "SELECT name, salary FROM employees WHERE salary > (SELECT AVG(salary) FROM employees) ORDER BY salary DESC;",
      '-- EXPECTED: [{"name":"Carol","salary":95000},{"name":"Alice","salary":90000}]',
    ].join("\n"),
    source: "spider",
  },
];

/* ------------------------------------------------------------------ */
/* Loader                                                               */
/* ------------------------------------------------------------------ */

export function loadBenchmarkTasks(): { train: CodeTask[]; eval: CodeTask[] } {
  const allTasks: CodeTask[] = [
    ...PYTHON_TASKS.map((t) => ({ ...t, id: randomUUID() })),
    ...SQL_TASKS.map((t) => ({ ...t, id: randomUUID() })),
  ];

  const seeded = allTasks.map((t) => ({ t, seed: hashCode(t.prompt) }));
  seeded.sort((a, b) => a.seed - b.seed);

  const splitIdx = Math.floor(allTasks.length * (1 - EVAL_SPLIT_SIZE));
  return {
    train: seeded.slice(0, splitIdx).map((s) => s.t),
    eval: seeded.slice(splitIdx).map((s) => s.t),
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

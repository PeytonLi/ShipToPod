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

/* ------------------------------------------------------------------ */
/* Shared fixture strings                                               */
/* ------------------------------------------------------------------ */

const ECOM_FIXTURE = [
  "CREATE TABLE customers (id INT, name TEXT, email TEXT, city TEXT, registration_date TEXT);",
  "INSERT INTO customers VALUES (1, 'Alice Johnson', 'alice@email.com', 'New York', '2023-01-15');",
  "INSERT INTO customers VALUES (2, 'Bob Smith', 'bob@email.com', 'Los Angeles', '2023-02-20');",
  "INSERT INTO customers VALUES (3, 'Carol White', 'carol@email.com', 'Chicago', '2023-01-10');",
  "INSERT INTO customers VALUES (4, 'Dave Brown', 'dave@email.com', 'New York', '2023-03-05');",
  "INSERT INTO customers VALUES (5, 'Eve Davis', 'eve@email.com', 'Los Angeles', '2023-02-14');",
  "INSERT INTO customers VALUES (6, 'Frank Wilson', 'frank@email.com', 'Chicago', '2023-04-01');",
  "INSERT INTO customers VALUES (7, 'Grace Lee', 'grace@email.com', 'New York', '2023-03-15');",
  "INSERT INTO customers VALUES (8, 'Henry Clark', 'henry@email.com', 'Los Angeles', '2023-05-10');",
  "CREATE TABLE products (id INT, name TEXT, category TEXT, price REAL);",
  "INSERT INTO products VALUES (1, 'Laptop', 'Electronics', 1200.0);",
  "INSERT INTO products VALUES (2, 'Mouse', 'Electronics', 30.0);",
  "INSERT INTO products VALUES (3, 'Keyboard', 'Electronics', 90.0);",
  "INSERT INTO products VALUES (4, 'Desk Chair', 'Furniture', 360.0);",
  "INSERT INTO products VALUES (5, 'Desk Lamp', 'Furniture', 60.0);",
  "INSERT INTO products VALUES (6, 'Notebook', 'Stationery', 6.0);",
  "INSERT INTO products VALUES (7, 'Pen Set', 'Stationery', 15.0);",
  "INSERT INTO products VALUES (8, 'Monitor', 'Electronics', 300.0);",
  "CREATE TABLE orders (id INT, customer_id INT, order_date TEXT, status TEXT);",
  "INSERT INTO orders VALUES (1, 1, '2023-03-10', 'delivered');",
  "INSERT INTO orders VALUES (2, 1, '2023-05-20', 'delivered');",
  "INSERT INTO orders VALUES (3, 2, '2023-04-15', 'delivered');",
  "INSERT INTO orders VALUES (4, 3, '2023-02-28', 'delivered');",
  "INSERT INTO orders VALUES (5, 3, '2023-06-01', 'shipped');",
  "INSERT INTO orders VALUES (6, 4, '2023-03-20', 'delivered');",
  "INSERT INTO orders VALUES (7, 5, '2023-05-05', 'delivered');",
  "INSERT INTO orders VALUES (8, 5, '2023-06-15', 'pending');",
  "INSERT INTO orders VALUES (9, 6, '2023-04-10', 'delivered');",
  "INSERT INTO orders VALUES (10, 7, '2023-06-10', 'delivered');",
  "CREATE TABLE order_items (id INT, order_id INT, product_id INT, quantity INT);",
  "INSERT INTO order_items VALUES (1, 1, 1, 1);",
  "INSERT INTO order_items VALUES (2, 1, 2, 2);",
  "INSERT INTO order_items VALUES (3, 2, 3, 1);",
  "INSERT INTO order_items VALUES (4, 2, 4, 1);",
  "INSERT INTO order_items VALUES (5, 3, 1, 1);",
  "INSERT INTO order_items VALUES (6, 3, 5, 2);",
  "INSERT INTO order_items VALUES (7, 4, 2, 3);",
  "INSERT INTO order_items VALUES (8, 4, 6, 5);",
  "INSERT INTO order_items VALUES (9, 5, 7, 1);",
  "INSERT INTO order_items VALUES (10, 5, 8, 1);",
  "INSERT INTO order_items VALUES (11, 6, 1, 1);",
  "INSERT INTO order_items VALUES (12, 6, 3, 1);",
  "INSERT INTO order_items VALUES (13, 7, 4, 2);",
  "INSERT INTO order_items VALUES (14, 7, 5, 1);",
  "INSERT INTO order_items VALUES (15, 8, 6, 10);",
  "INSERT INTO order_items VALUES (16, 9, 7, 2);",
  "INSERT INTO order_items VALUES (17, 10, 2, 1);",
  "INSERT INTO order_items VALUES (18, 10, 8, 1);",
].join("\n");

const EDU_FIXTURE = [
  "CREATE TABLE students (id INT, name TEXT, major TEXT, year INT);",
  "INSERT INTO students VALUES (1, 'Alice Johnson', 'Computer Science', 2024);",
  "INSERT INTO students VALUES (2, 'Bob Smith', 'Mathematics', 2023);",
  "INSERT INTO students VALUES (3, 'Carol White', 'Computer Science', 2024);",
  "INSERT INTO students VALUES (4, 'Dave Brown', 'Physics', 2022);",
  "INSERT INTO students VALUES (5, 'Eve Davis', 'Mathematics', 2023);",
  "INSERT INTO students VALUES (6, 'Frank Wilson', 'Computer Science', 2022);",
  "INSERT INTO students VALUES (7, 'Grace Lee', 'Physics', 2024);",
  "INSERT INTO students VALUES (8, 'Henry Clark', 'Mathematics', 2022);",
  "CREATE TABLE professors (id INT, name TEXT, department TEXT);",
  "INSERT INTO professors VALUES (1, 'Dr. Adams', 'Computer Science');",
  "INSERT INTO professors VALUES (2, 'Dr. Baker', 'Mathematics');",
  "INSERT INTO professors VALUES (3, 'Dr. Chen', 'Physics');",
  "INSERT INTO professors VALUES (4, 'Dr. Diaz', 'Computer Science');",
  "CREATE TABLE courses (id INT, name TEXT, department TEXT, credits INT, professor_id INT);",
  "INSERT INTO courses VALUES (1, 'Data Structures', 'Computer Science', 4, 1);",
  "INSERT INTO courses VALUES (2, 'Algorithms', 'Computer Science', 4, 1);",
  "INSERT INTO courses VALUES (3, 'Calculus I', 'Mathematics', 3, 2);",
  "INSERT INTO courses VALUES (4, 'Linear Algebra', 'Mathematics', 3, 2);",
  "INSERT INTO courses VALUES (5, 'Mechanics', 'Physics', 4, 3);",
  "INSERT INTO courses VALUES (6, 'Database Systems', 'Computer Science', 3, 4);",
  "INSERT INTO courses VALUES (7, 'Quantum Physics', 'Physics', 4, 3);",
  "CREATE TABLE enrollments (id INT, student_id INT, course_id INT, grade TEXT, semester TEXT);",
  "INSERT INTO enrollments VALUES (1, 1, 1, 'A', 'Fall 2023');",
  "INSERT INTO enrollments VALUES (2, 1, 2, 'B+', 'Fall 2023');",
  "INSERT INTO enrollments VALUES (3, 1, 6, 'A-', 'Spring 2024');",
  "INSERT INTO enrollments VALUES (4, 2, 3, 'B', 'Fall 2023');",
  "INSERT INTO enrollments VALUES (5, 2, 4, 'A', 'Spring 2024');",
  "INSERT INTO enrollments VALUES (6, 3, 1, 'B', 'Fall 2023');",
  "INSERT INTO enrollments VALUES (7, 3, 2, 'A', 'Spring 2024');",
  "INSERT INTO enrollments VALUES (8, 3, 6, 'A', 'Spring 2024');",
  "INSERT INTO enrollments VALUES (9, 4, 5, 'C+', 'Fall 2022');",
  "INSERT INTO enrollments VALUES (10, 4, 7, 'B-', 'Spring 2023');",
  "INSERT INTO enrollments VALUES (11, 5, 3, 'A-', 'Fall 2023');",
  "INSERT INTO enrollments VALUES (12, 5, 4, 'B+', 'Spring 2024');",
  "INSERT INTO enrollments VALUES (13, 6, 1, 'A', 'Fall 2022');",
  "INSERT INTO enrollments VALUES (14, 6, 2, 'A', 'Spring 2023');",
  "INSERT INTO enrollments VALUES (15, 6, 6, 'A-', 'Fall 2023');",
  "INSERT INTO enrollments VALUES (16, 7, 5, 'B', 'Spring 2024');",
  "INSERT INTO enrollments VALUES (17, 7, 7, 'B+', 'Spring 2024');",
  "INSERT INTO enrollments VALUES (18, 8, 3, 'C', 'Fall 2022');",
  "INSERT INTO enrollments VALUES (19, 8, 4, 'B-', 'Spring 2023');",
].join("\n");

const BOOKS_FIXTURE = [
  "CREATE TABLE authors (id INT, name TEXT, birth_year INT, nationality TEXT);",
  "INSERT INTO authors VALUES (1, 'George Orwell', 1903, 'British');",
  "INSERT INTO authors VALUES (2, 'J.K. Rowling', 1965, 'British');",
  "INSERT INTO authors VALUES (3, 'J.R.R. Tolkien', 1892, 'British');",
  "INSERT INTO authors VALUES (4, 'Haruki Murakami', 1949, 'Japanese');",
  "INSERT INTO authors VALUES (5, 'Jane Austen', 1775, 'British');",
  "INSERT INTO authors VALUES (6, 'Mark Twain', 1835, 'American');",
  "INSERT INTO authors VALUES (7, 'Gabriel Garcia Marquez', 1927, 'Colombian');",
  "CREATE TABLE publishers (id INT, name TEXT, city TEXT, founded_year INT);",
  "INSERT INTO publishers VALUES (1, 'Penguin Books', 'London', 1935);",
  "INSERT INTO publishers VALUES (2, 'Bloomsbury', 'London', 1986);",
  "INSERT INTO publishers VALUES (3, 'HarperCollins', 'New York', 1989);",
  "INSERT INTO publishers VALUES (4, 'Vintage Books', 'New York', 1954);",
  "INSERT INTO publishers VALUES (5, 'Shueisha', 'Tokyo', 1925);",
  "CREATE TABLE books (id INT, title TEXT, author_id INT, publisher_id INT, year INT, genre TEXT, price REAL, pages INT);",
  "INSERT INTO books VALUES (1, '1984', 1, 1, 1949, 'Fiction', 10, 328);",
  "INSERT INTO books VALUES (2, 'Animal Farm', 1, 1, 1945, 'Fiction', 8, 112);",
  "INSERT INTO books VALUES (3, 'Harry Potter and the Sorcerers Stone', 2, 2, 1997, 'Fantasy', 13, 309);",
  "INSERT INTO books VALUES (4, 'Harry Potter and the Chamber of Secrets', 2, 2, 1998, 'Fantasy', 13, 341);",
  "INSERT INTO books VALUES (5, 'The Hobbit', 3, 3, 1937, 'Fantasy', 11, 310);",
  "INSERT INTO books VALUES (6, 'The Lord of the Rings', 3, 3, 1954, 'Fantasy', 20, 1178);",
  "INSERT INTO books VALUES (7, 'Norwegian Wood', 4, 4, 1987, 'Fiction', 12, 296);",
  "INSERT INTO books VALUES (8, 'Kafka on the Shore', 4, 4, 2002, 'Fiction', 14, 467);",
  "INSERT INTO books VALUES (9, 'Pride and Prejudice', 5, 1, 1813, 'Fiction', 7, 432);",
  "INSERT INTO books VALUES (10, 'Adventures of Huckleberry Finn', 6, 3, 1884, 'Adventure', 9, 366);",
  "INSERT INTO books VALUES (11, 'One Hundred Years of Solitude', 7, 3, 1967, 'Fiction', 15, 417);",
].join("\n");

const EMP_FIXTURE = [
  "CREATE TABLE departments (id INT, name TEXT, location TEXT, budget INT);",
  "INSERT INTO departments VALUES (1, 'Engineering', 'Building A', 1500000);",
  "INSERT INTO departments VALUES (2, 'Sales', 'Building B', 800000);",
  "INSERT INTO departments VALUES (3, 'Marketing', 'Building B', 600000);",
  "INSERT INTO departments VALUES (4, 'Human Resources', 'Building A', 400000);",
  "INSERT INTO departments VALUES (5, 'Finance', 'Building A', 500000);",
  "CREATE TABLE employees (id INT, name TEXT, department_id INT, salary INT, title TEXT, hire_year INT, manager_id INT);",
  "INSERT INTO employees VALUES (1, 'Alice Chen', 1, 105000, 'Senior Engineer', 2018, NULL);",
  "INSERT INTO employees VALUES (2, 'Bob Martinez', 1, 90000, 'Engineer', 2020, 1);",
  "INSERT INTO employees VALUES (3, 'Carol Williams', 1, 75000, 'Engineer', 2021, 1);",
  "INSERT INTO employees VALUES (4, 'Dave Johnson', 2, 75000, 'Sales Rep', 2019, NULL);",
  "INSERT INTO employees VALUES (5, 'Eve Thompson', 2, 72000, 'Sales Rep', 2020, 4);",
  "INSERT INTO employees VALUES (6, 'Frank Garcia', 2, 69000, 'Junior Sales', 2022, 4);",
  "INSERT INTO employees VALUES (7, 'Grace Kim', 3, 80000, 'Marketing Lead', 2019, NULL);",
  "INSERT INTO employees VALUES (8, 'Henry Davis', 3, 60000, 'Marketing Specialist', 2021, 7);",
  "INSERT INTO employees VALUES (9, 'Iris Lopez', 4, 70000, 'HR Manager', 2017, NULL);",
  "INSERT INTO employees VALUES (10, 'Jack Wilson', 4, 56000, 'HR Coordinator', 2022, 9);",
  "INSERT INTO employees VALUES (11, 'Kara Brown', 5, 96000, 'Finance Manager', 2018, NULL);",
  "INSERT INTO employees VALUES (12, 'Liam Taylor', 5, 72000, 'Accountant', 2020, 11);",
].join("\n");

/* ------------------------------------------------------------------ */
const SQL_TASKS: Omit<CodeTask, "id">[] = [
  /* ================================================================ */
  /* Legacy tasks (1-5)                                                */
  /* ================================================================ */
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

  /* ================================================================ */
  /* JOINs (10 tasks)                                                  */
  /* ================================================================ */

  {
    prompt:
      "Write a SELECT query to list all orders with the customer name and order date. Return order_id, customer_name, order_date, and status. Sort by order_id.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: orders_with_customers",
      "SELECT o.id AS order_id, c.name AS customer_name, o.order_date, o.status FROM orders o INNER JOIN customers c ON o.customer_id = c.id ORDER BY o.id;",
      '-- EXPECTED: [{"order_id":1,"customer_name":"Alice Johnson","order_date":"2023-03-10","status":"delivered"},{"order_id":2,"customer_name":"Alice Johnson","order_date":"2023-05-20","status":"delivered"},{"order_id":3,"customer_name":"Bob Smith","order_date":"2023-04-15","status":"delivered"},{"order_id":4,"customer_name":"Carol White","order_date":"2023-02-28","status":"delivered"},{"order_id":5,"customer_name":"Carol White","order_date":"2023-06-01","status":"shipped"},{"order_id":6,"customer_name":"Dave Brown","order_date":"2023-03-20","status":"delivered"},{"order_id":7,"customer_name":"Eve Davis","order_date":"2023-05-05","status":"delivered"},{"order_id":8,"customer_name":"Eve Davis","order_date":"2023-06-15","status":"pending"},{"order_id":9,"customer_name":"Frank Wilson","order_date":"2023-04-10","status":"delivered"},{"order_id":10,"customer_name":"Grace Lee","order_date":"2023-06-10","status":"delivered"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to list every customer and the number of orders they placed, including customers with zero orders. Return customer_name and order_count. Order by order_count DESC, then customer_name.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: left_join_order_count",
      "SELECT c.name AS customer_name, COUNT(o.id) AS order_count FROM customers c LEFT JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name ORDER BY order_count DESC, customer_name;",
      '-- EXPECTED: [{"customer_name":"Alice Johnson","order_count":2},{"customer_name":"Carol White","order_count":2},{"customer_name":"Eve Davis","order_count":2},{"customer_name":"Bob Smith","order_count":1},{"customer_name":"Dave Brown","order_count":1},{"customer_name":"Frank Wilson","order_count":1},{"customer_name":"Grace Lee","order_count":1},{"customer_name":"Henry Clark","order_count":0}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to list all items purchased by customer Alice Johnson with product names and quantities. Return product_name and quantity. Order by product_name.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: multi_join_items_by_customer",
      "SELECT p.name AS product_name, oi.quantity FROM customers c INNER JOIN orders o ON c.id = o.customer_id INNER JOIN order_items oi ON o.id = oi.order_id INNER JOIN products p ON oi.product_id = p.id WHERE c.name = 'Alice Johnson' ORDER BY p.name;",
      '-- EXPECTED: [{"product_name":"Desk Chair","quantity":1},{"product_name":"Keyboard","quantity":1},{"product_name":"Laptop","quantity":1},{"product_name":"Mouse","quantity":2}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find the total amount each customer has spent across all their orders. A line total is price * quantity. Return customer_name and total_spent for customers who have at least one order. Order by total_spent DESC.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: multi_join_total_spent",
      "SELECT c.name AS customer_name, SUM(p.price * oi.quantity) AS total_spent FROM customers c INNER JOIN orders o ON c.id = o.customer_id INNER JOIN order_items oi ON o.id = oi.order_id INNER JOIN products p ON oi.product_id = p.id GROUP BY c.id, c.name ORDER BY total_spent DESC;",
      '-- EXPECTED: [{"customer_name":"Alice Johnson","total_spent":1710.0},{"customer_name":"Bob Smith","total_spent":1320.0},{"customer_name":"Dave Brown","total_spent":1290.0},{"customer_name":"Eve Davis","total_spent":840.0},{"customer_name":"Carol White","total_spent":435.0},{"customer_name":"Grace Lee","total_spent":330.0},{"customer_name":"Frank Wilson","total_spent":30.0}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find all pairs of customers who live in the same city. Return city, name1, and name2. Use a self-join and ensure name1 < name2 to avoid duplicates. Order by city, then name1.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: self_join_same_city",
      "SELECT c1.city, c1.name AS name1, c2.name AS name2 FROM customers c1 INNER JOIN customers c2 ON c1.city = c2.city AND c1.name < c2.name ORDER BY c1.city, c1.name;",
      '-- EXPECTED: [{"city":"Chicago","name1":"Carol White","name2":"Frank Wilson"},{"city":"Los Angeles","name1":"Bob Smith","name2":"Eve Davis"},{"city":"Los Angeles","name1":"Bob Smith","name2":"Henry Clark"},{"city":"Los Angeles","name1":"Eve Davis","name2":"Henry Clark"},{"city":"New York","name1":"Alice Johnson","name2":"Dave Brown"},{"city":"New York","name1":"Alice Johnson","name2":"Grace Lee"},{"city":"New York","name1":"Dave Brown","name2":"Grace Lee"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to list students with the courses they are enrolled in, including the course name and grade. Return student_name, course_name, and grade. Order by student_name, then course_name.",
    language: "sql",
    fixture: EDU_FIXTURE,
    hidden_tests: [
      "-- TEST: students_courses_grades",
      "SELECT s.name AS student_name, c.name AS course_name, e.grade FROM students s INNER JOIN enrollments e ON s.id = e.student_id INNER JOIN courses c ON e.course_id = c.id ORDER BY s.name, c.name;",
      '-- EXPECTED: [{"student_name":"Alice Johnson","course_name":"Algorithms","grade":"B+"},{"student_name":"Alice Johnson","course_name":"Data Structures","grade":"A"},{"student_name":"Alice Johnson","course_name":"Database Systems","grade":"A-"},{"student_name":"Bob Smith","course_name":"Calculus I","grade":"B"},{"student_name":"Bob Smith","course_name":"Linear Algebra","grade":"A"},{"student_name":"Carol White","course_name":"Algorithms","grade":"A"},{"student_name":"Carol White","course_name":"Data Structures","grade":"B"},{"student_name":"Carol White","course_name":"Database Systems","grade":"A"},{"student_name":"Dave Brown","course_name":"Mechanics","grade":"C+"},{"student_name":"Dave Brown","course_name":"Quantum Physics","grade":"B-"},{"student_name":"Eve Davis","course_name":"Calculus I","grade":"A-"},{"student_name":"Eve Davis","course_name":"Linear Algebra","grade":"B+"},{"student_name":"Frank Wilson","course_name":"Algorithms","grade":"A"},{"student_name":"Frank Wilson","course_name":"Data Structures","grade":"A"},{"student_name":"Frank Wilson","course_name":"Database Systems","grade":"A-"},{"student_name":"Grace Lee","course_name":"Mechanics","grade":"B"},{"student_name":"Grace Lee","course_name":"Quantum Physics","grade":"B+"},{"student_name":"Henry Clark","course_name":"Calculus I","grade":"C"},{"student_name":"Henry Clark","course_name":"Linear Algebra","grade":"B-"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find students and their professors for each enrollment. Return student_name, course_name, and professor_name. Order by student_name, then course_name.",
    language: "sql",
    fixture: EDU_FIXTURE,
    hidden_tests: [
      "-- TEST: students_professors",
      "SELECT s.name AS student_name, c.name AS course_name, p.name AS professor_name FROM students s INNER JOIN enrollments e ON s.id = e.student_id INNER JOIN courses c ON e.course_id = c.id INNER JOIN professors p ON c.professor_id = p.id ORDER BY s.name, c.name;",
      '-- EXPECTED: [{"student_name":"Alice Johnson","course_name":"Algorithms","professor_name":"Dr. Adams"},{"student_name":"Alice Johnson","course_name":"Data Structures","professor_name":"Dr. Adams"},{"student_name":"Alice Johnson","course_name":"Database Systems","professor_name":"Dr. Diaz"},{"student_name":"Bob Smith","course_name":"Calculus I","professor_name":"Dr. Baker"},{"student_name":"Bob Smith","course_name":"Linear Algebra","professor_name":"Dr. Baker"},{"student_name":"Carol White","course_name":"Algorithms","professor_name":"Dr. Adams"},{"student_name":"Carol White","course_name":"Data Structures","professor_name":"Dr. Adams"},{"student_name":"Carol White","course_name":"Database Systems","professor_name":"Dr. Diaz"},{"student_name":"Dave Brown","course_name":"Mechanics","professor_name":"Dr. Chen"},{"student_name":"Dave Brown","course_name":"Quantum Physics","professor_name":"Dr. Chen"},{"student_name":"Eve Davis","course_name":"Calculus I","professor_name":"Dr. Baker"},{"student_name":"Eve Davis","course_name":"Linear Algebra","professor_name":"Dr. Baker"},{"student_name":"Frank Wilson","course_name":"Algorithms","professor_name":"Dr. Adams"},{"student_name":"Frank Wilson","course_name":"Data Structures","professor_name":"Dr. Adams"},{"student_name":"Frank Wilson","course_name":"Database Systems","professor_name":"Dr. Diaz"},{"student_name":"Grace Lee","course_name":"Mechanics","professor_name":"Dr. Chen"},{"student_name":"Grace Lee","course_name":"Quantum Physics","professor_name":"Dr. Chen"},{"student_name":"Henry Clark","course_name":"Calculus I","professor_name":"Dr. Baker"},{"student_name":"Henry Clark","course_name":"Linear Algebra","professor_name":"Dr. Baker"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to list each book with its author name and publisher name. Return book_title, author_name, and publisher_name. Order by book_title.",
    language: "sql",
    fixture: BOOKS_FIXTURE,
    hidden_tests: [
      "-- TEST: books_authors_publishers",
      "SELECT b.title AS book_title, a.name AS author_name, p.name AS publisher_name FROM books b INNER JOIN authors a ON b.author_id = a.id INNER JOIN publishers p ON b.publisher_id = p.id ORDER BY b.title;",
      '-- EXPECTED: [{"book_title":"1984","author_name":"George Orwell","publisher_name":"Penguin Books"},{"book_title":"Adventures of Huckleberry Finn","author_name":"Mark Twain","publisher_name":"HarperCollins"},{"book_title":"Animal Farm","author_name":"George Orwell","publisher_name":"Penguin Books"},{"book_title":"Harry Potter and the Chamber of Secrets","author_name":"J.K. Rowling","publisher_name":"Bloomsbury"},{"book_title":"Harry Potter and the Sorcerers Stone","author_name":"J.K. Rowling","publisher_name":"Bloomsbury"},{"book_title":"Kafka on the Shore","author_name":"Haruki Murakami","publisher_name":"Vintage Books"},{"book_title":"Norwegian Wood","author_name":"Haruki Murakami","publisher_name":"Vintage Books"},{"book_title":"One Hundred Years of Solitude","author_name":"Gabriel Garcia Marquez","publisher_name":"HarperCollins"},{"book_title":"Pride and Prejudice","author_name":"Jane Austen","publisher_name":"Penguin Books"},{"book_title":"The Hobbit","author_name":"J.R.R. Tolkien","publisher_name":"HarperCollins"},{"book_title":"The Lord of the Rings","author_name":"J.R.R. Tolkien","publisher_name":"HarperCollins"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to list each course with the number of students enrolled. Include courses that have no enrollments. Return course_name and enrollment_count. Order by enrollment_count DESC, then course_name.",
    language: "sql",
    fixture: EDU_FIXTURE,
    hidden_tests: [
      "-- TEST: left_join_course_enrollment_count",
      "SELECT c.name AS course_name, COUNT(e.id) AS enrollment_count FROM courses c LEFT JOIN enrollments e ON c.id = e.course_id GROUP BY c.id, c.name ORDER BY enrollment_count DESC, course_name;",
      '-- EXPECTED: [{"course_name":"Calculus I","enrollment_count":3},{"course_name":"Data Structures","enrollment_count":3},{"course_name":"Algorithms","enrollment_count":3},{"course_name":"Database Systems","enrollment_count":3},{"course_name":"Linear Algebra","enrollment_count":3},{"course_name":"Mechanics","enrollment_count":2},{"course_name":"Quantum Physics","enrollment_count":2}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using CROSS JOIN to generate all possible size and color combinations for a product catalog. Return size_label, color_name. Order by size_label, then color_name.",
    language: "sql",
    fixture: [
      "CREATE TABLE sizes (label TEXT);",
      "INSERT INTO sizes VALUES ('Small');",
      "INSERT INTO sizes VALUES ('Medium');",
      "INSERT INTO sizes VALUES ('Large');",
      "CREATE TABLE colors (name TEXT);",
      "INSERT INTO colors VALUES ('Red');",
      "INSERT INTO colors VALUES ('Blue');",
      "INSERT INTO colors VALUES ('Green');",
      "INSERT INTO colors VALUES ('Black');",
    ].join("\n"),
    hidden_tests: [
      "-- TEST: cross_join_size_color",
      "SELECT s.label AS size_label, c.name AS color_name FROM sizes s CROSS JOIN colors c ORDER BY s.label, c.name;",
      '-- EXPECTED: [{"size_label":"Large","color_name":"Black"},{"size_label":"Large","color_name":"Blue"},{"size_label":"Large","color_name":"Green"},{"size_label":"Large","color_name":"Red"},{"size_label":"Medium","color_name":"Black"},{"size_label":"Medium","color_name":"Blue"},{"size_label":"Medium","color_name":"Green"},{"size_label":"Medium","color_name":"Red"},{"size_label":"Small","color_name":"Black"},{"size_label":"Small","color_name":"Blue"},{"size_label":"Small","color_name":"Green"},{"size_label":"Small","color_name":"Red"}]',
    ].join("\n"),
    source: "spider",
  },

  /* ================================================================ */
  /* Aggregation (8 tasks)                                             */
  /* ================================================================ */

  {
    prompt:
      "Write a SELECT query to count how many orders each customer has placed. Return customer_name and order_count. Order by order_count DESC.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: groupby_order_count",
      "SELECT c.name AS customer_name, COUNT(o.id) AS order_count FROM customers c INNER JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name ORDER BY order_count DESC;",
      '-- EXPECTED: [{"customer_name":"Alice Johnson","order_count":2},{"customer_name":"Carol White","order_count":2},{"customer_name":"Eve Davis","order_count":2},{"customer_name":"Bob Smith","order_count":1},{"customer_name":"Dave Brown","order_count":1},{"customer_name":"Frank Wilson","order_count":1},{"customer_name":"Grace Lee","order_count":1}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find the total revenue (price * quantity) per product category. Return category and total_revenue. Order by total_revenue DESC.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: groupby_category_revenue",
      "SELECT p.category, SUM(p.price * oi.quantity) AS total_revenue FROM products p INNER JOIN order_items oi ON p.id = oi.product_id GROUP BY p.category ORDER BY total_revenue DESC;",
      '-- EXPECTED: [{"category":"Electronics","total_revenue":4410.0},{"category":"Furniture","total_revenue":1500.0},{"category":"Stationery","total_revenue":105.0}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find the average book price per genre. Return genre and avg_price. Order by avg_price DESC.",
    language: "sql",
    fixture: BOOKS_FIXTURE,
    hidden_tests: [
      "-- TEST: groupby_avg_price_by_genre",
      "SELECT genre, ROUND(AVG(price), 2) AS avg_price FROM books GROUP BY genre ORDER BY avg_price DESC;",
      '-- EXPECTED: [{"genre":"Fantasy","avg_price":14.25},{"genre":"Fiction","avg_price":11},{"genre":"Adventure","avg_price":9}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find departments whose total employee count is at least 2. Return department_name and employee_count. Order by department_name.",
    language: "sql",
    fixture: EMP_FIXTURE,
    hidden_tests: [
      "-- TEST: having_min_employee_count",
      "SELECT d.name AS department_name, COUNT(e.id) AS employee_count FROM departments d INNER JOIN employees e ON d.id = e.department_id GROUP BY d.id, d.name HAVING employee_count >= 2 ORDER BY department_name;",
      '-- EXPECTED: [{"department_name":"Engineering","employee_count":3},{"department_name":"Finance","employee_count":2},{"department_name":"Human Resources","employee_count":2},{"department_name":"Marketing","employee_count":2},{"department_name":"Sales","employee_count":3}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to compute per-department salary statistics: minimum, maximum, and average salary. Round the average to 2 decimal places. Return department_name, min_salary, max_salary, avg_salary. Order by avg_salary DESC.",
    language: "sql",
    fixture: EMP_FIXTURE,
    hidden_tests: [
      "-- TEST: groupby_multi_aggregates",
      "SELECT d.name AS department_name, MIN(e.salary) AS min_salary, MAX(e.salary) AS max_salary, AVG(e.salary) AS avg_salary FROM departments d INNER JOIN employees e ON d.id = e.department_id GROUP BY d.id, d.name ORDER BY avg_salary DESC;",
      '-- EXPECTED: [{"department_name":"Engineering","min_salary":75000,"max_salary":105000,"avg_salary":90000},{"department_name":"Finance","min_salary":72000,"max_salary":96000,"avg_salary":84000},{"department_name":"Sales","min_salary":69000,"max_salary":75000,"avg_salary":72000},{"department_name":"Marketing","min_salary":60000,"max_salary":80000,"avg_salary":70000},{"department_name":"Human Resources","min_salary":56000,"max_salary":70000,"avg_salary":63000}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to count how many distinct cities customers live in. Return the count as city_count.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: count_distinct_cities",
      "SELECT COUNT(DISTINCT city) AS city_count FROM customers;",
      '-- EXPECTED: [{"city_count":4}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find products that have been ordered more than twice (total quantity across all orders). Return product_name and total_quantity. Order by total_quantity DESC.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: having_total_quantity_gt_2",
      "SELECT p.name AS product_name, SUM(oi.quantity) AS total_quantity FROM products p INNER JOIN order_items oi ON p.id = oi.product_id GROUP BY p.id, p.name HAVING total_quantity > 2 ORDER BY total_quantity DESC;",
      '-- EXPECTED: [{"product_name":"Notebook","total_quantity":15},{"product_name":"Mouse","total_quantity":6},{"product_name":"Desk Chair","total_quantity":3},{"product_name":"Desk Lamp","total_quantity":3},{"product_name":"Laptop","total_quantity":3},{"product_name":"Pen Set","total_quantity":3}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find the most expensive book. Return title and price.",
    language: "sql",
    fixture: BOOKS_FIXTURE,
    hidden_tests: [
      "-- TEST: max_price_book",
      "SELECT title, price FROM books WHERE price = (SELECT MAX(price) FROM books) ORDER BY title;",
      '-- EXPECTED: [{"title":"The Lord of the Rings","price":20}]',
    ].join("\n"),
    source: "spider",
  },

  /* ================================================================ */
  /* Subqueries (8 tasks)                                              */
  /* ================================================================ */

  {
    prompt:
      "Write a SELECT query using EXISTS to find customers who have placed at least one order. Return customer_name and email. Order by customer_name.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: exists_has_orders",
      "SELECT name AS customer_name, email FROM customers c WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id) ORDER BY customer_name;",
      '-- EXPECTED: [{"customer_name":"Alice Johnson","email":"alice@email.com"},{"customer_name":"Bob Smith","email":"bob@email.com"},{"customer_name":"Carol White","email":"carol@email.com"},{"customer_name":"Dave Brown","email":"dave@email.com"},{"customer_name":"Eve Davis","email":"eve@email.com"},{"customer_name":"Frank Wilson","email":"frank@email.com"},{"customer_name":"Grace Lee","email":"grace@email.com"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using NOT EXISTS to find products that have never been ordered. Return product_name and category. Order by product_name.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: not_exists_products_never_ordered",
      "SELECT p.name AS product_name, p.category FROM products p WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id) ORDER BY product_name;",
      "-- EXPECTED: []",
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using IN to find students who are enrolled in courses taught by Dr. Adams. Return student_name. Order by student_name.",
    language: "sql",
    fixture: EDU_FIXTURE,
    hidden_tests: [
      "-- TEST: subquery_in_adams_courses",
      "SELECT s.name AS student_name FROM students s WHERE s.id IN (SELECT e.student_id FROM enrollments e WHERE e.course_id IN (SELECT c.id FROM courses c WHERE c.professor_id = (SELECT p.id FROM professors p WHERE p.name = 'Dr. Adams'))) ORDER BY student_name;",
      '-- EXPECTED: [{"student_name":"Alice Johnson"},{"student_name":"Carol White"},{"student_name":"Frank Wilson"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using NOT IN to find students who are not enrolled in any Computer Science course. Return student_name and major. Order by student_name.",
    language: "sql",
    fixture: EDU_FIXTURE,
    hidden_tests: [
      "-- TEST: not_in_cs_courses",
      "SELECT s.name AS student_name, s.major FROM students s WHERE s.id NOT IN (SELECT e.student_id FROM enrollments e INNER JOIN courses c ON e.course_id = c.id WHERE c.department = 'Computer Science') ORDER BY student_name;",
      '-- EXPECTED: [{"student_name":"Bob Smith","major":"Mathematics"},{"student_name":"Dave Brown","major":"Physics"},{"student_name":"Eve Davis","major":"Mathematics"},{"student_name":"Grace Lee","major":"Physics"},{"student_name":"Henry Clark","major":"Mathematics"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to list each book with its price and how much it differs from the average book price (price - avg_price). Return title, price, and price_diff. Round price_diff to 2 decimal places. Order by price_diff DESC.",
    language: "sql",
    fixture: BOOKS_FIXTURE,
    hidden_tests: [
      "-- TEST: scalar_subquery_price_diff",
      "SELECT title, price, ROUND(price - (SELECT AVG(price) FROM books), 2) AS price_diff FROM books ORDER BY price_diff DESC;",
      '-- EXPECTED: [{"title":"The Lord of the Rings","price":20,"price_diff":8},{"title":"One Hundred Years of Solitude","price":15,"price_diff":3},{"title":"Kafka on the Shore","price":14,"price_diff":2},{"title":"Harry Potter and the Sorcerers Stone","price":13,"price_diff":1},{"title":"Harry Potter and the Chamber of Secrets","price":13,"price_diff":1},{"title":"Norwegian Wood","price":12,"price_diff":0},{"title":"The Hobbit","price":11,"price_diff":-1},{"title":"1984","price":10,"price_diff":-2},{"title":"Adventures of Huckleberry Finn","price":9,"price_diff":-3},{"title":"Animal Farm","price":8,"price_diff":-4},{"title":"Pride and Prejudice","price":7,"price_diff":-5}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find employees who earn more than the average salary in their own department. Return name, department_name, and salary. Order by salary DESC.",
    language: "sql",
    fixture: EMP_FIXTURE,
    hidden_tests: [
      "-- TEST: correlated_subquery_above_dept_avg",
      "SELECT e.name, d.name AS department_name, e.salary FROM employees e INNER JOIN departments d ON e.department_id = d.id WHERE e.salary > (SELECT AVG(e2.salary) FROM employees e2 WHERE e2.department_id = e.department_id) ORDER BY e.salary DESC;",
      '-- EXPECTED: [{"name":"Alice Chen","department_name":"Engineering","salary":105000},{"name":"Kara Brown","department_name":"Finance","salary":96000},{"name":"Grace Kim","department_name":"Marketing","salary":80000},{"name":"Dave Johnson","department_name":"Sales","salary":75000},{"name":"Iris Lopez","department_name":"Human Resources","salary":70000}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find the top 3 authors with the most books. Return author_name and book_count. Order by book_count DESC.",
    language: "sql",
    fixture: BOOKS_FIXTURE,
    hidden_tests: [
      "-- TEST: subquery_from_top_authors",
      "SELECT a.name AS author_name, b.book_count FROM (SELECT author_id, COUNT(*) AS book_count FROM books GROUP BY author_id ORDER BY book_count DESC LIMIT 3) b INNER JOIN authors a ON b.author_id = a.id ORDER BY b.book_count DESC;",
      '-- EXPECTED: [{"author_name":"George Orwell","book_count":2},{"author_name":"J.K. Rowling","book_count":2},{"author_name":"J.R.R. Tolkien","book_count":2}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using a subquery to find orders where the total value (sum of price * quantity) exceeds $500. Return order_id and order_total. Order by order_total DESC.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: subquery_order_total_gt_500",
      "SELECT oi.order_id, SUM(p.price * oi.quantity) AS order_total FROM order_items oi INNER JOIN products p ON oi.product_id = p.id GROUP BY oi.order_id HAVING order_total > 500 ORDER BY order_total DESC;",
      '-- EXPECTED: [{"order_id":1,"order_total":1260.0},{"order_id":6,"order_total":1290.0},{"order_id":3,"order_total":1320.0},{"order_id":7,"order_total":780.0}]',
    ].join("\n"),
    source: "spider",
  },

  /* ================================================================ */
  /* Window functions (5 tasks)                                        */
  /* ================================================================ */

  {
    prompt:
      "Write a SELECT query using RANK() to rank employees by salary within each department, highest salary first. Return department_name, employee_name, salary, and rank. Order by department_name, then rank.",
    language: "sql",
    fixture: EMP_FIXTURE,
    hidden_tests: [
      "-- TEST: rank_employees_by_salary",
      "SELECT d.name AS department_name, e.name AS employee_name, e.salary, RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS rank FROM employees e INNER JOIN departments d ON e.department_id = d.id ORDER BY department_name, rank;",
      '-- EXPECTED: [{"department_name":"Engineering","employee_name":"Alice Chen","salary":105000,"rank":1},{"department_name":"Engineering","employee_name":"Bob Martinez","salary":90000,"rank":2},{"department_name":"Engineering","employee_name":"Carol Williams","salary":75000,"rank":3},{"department_name":"Finance","employee_name":"Kara Brown","salary":96000,"rank":1},{"department_name":"Finance","employee_name":"Liam Taylor","salary":72000,"rank":2},{"department_name":"Human Resources","employee_name":"Iris Lopez","salary":70000,"rank":1},{"department_name":"Human Resources","employee_name":"Jack Wilson","salary":56000,"rank":2},{"department_name":"Marketing","employee_name":"Grace Kim","salary":80000,"rank":1},{"department_name":"Marketing","employee_name":"Henry Davis","salary":60000,"rank":2},{"department_name":"Sales","employee_name":"Dave Johnson","salary":75000,"rank":1},{"department_name":"Sales","employee_name":"Eve Thompson","salary":72000,"rank":2},{"department_name":"Sales","employee_name":"Frank Garcia","salary":69000,"rank":3}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using ROW_NUMBER() to number each customer's orders chronologically (1 for their first order, 2 for second, etc.). Return customer_name, order_date, and order_seq. Order by customer_name, then order_seq.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: row_number_orders",
      "SELECT c.name AS customer_name, o.order_date, ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY o.order_date) AS order_seq FROM customers c INNER JOIN orders o ON c.id = o.customer_id ORDER BY customer_name, order_seq;",
      '-- EXPECTED: [{"customer_name":"Alice Johnson","order_date":"2023-03-10","order_seq":1},{"customer_name":"Alice Johnson","order_date":"2023-05-20","order_seq":2},{"customer_name":"Bob Smith","order_date":"2023-04-15","order_seq":1},{"customer_name":"Carol White","order_date":"2023-02-28","order_seq":1},{"customer_name":"Carol White","order_date":"2023-06-01","order_seq":2},{"customer_name":"Dave Brown","order_date":"2023-03-20","order_seq":1},{"customer_name":"Eve Davis","order_date":"2023-05-05","order_seq":1},{"customer_name":"Eve Davis","order_date":"2023-06-15","order_seq":2},{"customer_name":"Frank Wilson","order_date":"2023-04-10","order_seq":1},{"customer_name":"Grace Lee","order_date":"2023-06-10","order_seq":1}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using LAG() to show each customer's orders with the date of their previous order. For the first order, show NULL. Return customer_name, order_date, and prev_order_date. Order by customer_name, then order_date.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: lag_previous_order",
      "SELECT c.name AS customer_name, o.order_date, LAG(o.order_date) OVER (PARTITION BY c.id ORDER BY o.order_date) AS prev_order_date FROM customers c INNER JOIN orders o ON c.id = o.customer_id ORDER BY customer_name, o.order_date;",
      '-- EXPECTED: [{"customer_name":"Alice Johnson","order_date":"2023-03-10","prev_order_date":null},{"customer_name":"Alice Johnson","order_date":"2023-05-20","prev_order_date":"2023-03-10"},{"customer_name":"Bob Smith","order_date":"2023-04-15","prev_order_date":null},{"customer_name":"Carol White","order_date":"2023-02-28","prev_order_date":null},{"customer_name":"Carol White","order_date":"2023-06-01","prev_order_date":"2023-02-28"},{"customer_name":"Dave Brown","order_date":"2023-03-20","prev_order_date":null},{"customer_name":"Eve Davis","order_date":"2023-05-05","prev_order_date":null},{"customer_name":"Eve Davis","order_date":"2023-06-15","prev_order_date":"2023-05-05"},{"customer_name":"Frank Wilson","order_date":"2023-04-10","prev_order_date":null},{"customer_name":"Grace Lee","order_date":"2023-06-10","prev_order_date":null}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to compute a running total of order values (price * quantity) across all orders ordered by order date. Return order_date, order_total, and running_total. Order by order_date.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: running_total_orders",
      "SELECT o.order_date, SUM(p.price * oi.quantity) AS order_total, SUM(SUM(p.price * oi.quantity)) OVER (ORDER BY o.order_date) AS running_total FROM orders o INNER JOIN order_items oi ON o.id = oi.order_id INNER JOIN products p ON oi.product_id = p.id GROUP BY o.id, o.order_date ORDER BY o.order_date;",
      '-- EXPECTED: [{"order_date":"2023-02-28","order_total":120.0,"running_total":120.0},{"order_date":"2023-03-10","order_total":1260.0,"running_total":1380.0},{"order_date":"2023-03-20","order_total":1290.0,"running_total":2670.0},{"order_date":"2023-04-10","order_total":30.0,"running_total":2700.0},{"order_date":"2023-04-15","order_total":1320.0,"running_total":4020.0},{"order_date":"2023-05-05","order_total":780.0,"running_total":4800.0},{"order_date":"2023-05-20","order_total":450.0,"running_total":5250.0},{"order_date":"2023-06-01","order_total":315.0,"running_total":5565.0},{"order_date":"2023-06-10","order_total":330.0,"running_total":5895.0},{"order_date":"2023-06-15","order_total":60.0,"running_total":5955.0}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using LEAD() to show each student's enrollments with the course they took next. Return student_name, current_course, and next_course (NULL if none). Order by student_name, then enrollment id.",
    language: "sql",
    fixture: EDU_FIXTURE,
    hidden_tests: [
      "-- TEST: lead_next_course",
      "SELECT s.name AS student_name, c.name AS current_course, LEAD(c.name) OVER (PARTITION BY s.id ORDER BY e.id) AS next_course FROM students s INNER JOIN enrollments e ON s.id = e.student_id INNER JOIN courses c ON e.course_id = c.id ORDER BY student_name, e.id;",
      '-- EXPECTED: [{"student_name":"Alice Johnson","current_course":"Data Structures","next_course":"Algorithms"},{"student_name":"Alice Johnson","current_course":"Algorithms","next_course":"Database Systems"},{"student_name":"Alice Johnson","current_course":"Database Systems","next_course":null},{"student_name":"Bob Smith","current_course":"Calculus I","next_course":"Linear Algebra"},{"student_name":"Bob Smith","current_course":"Linear Algebra","next_course":null},{"student_name":"Carol White","current_course":"Data Structures","next_course":"Algorithms"},{"student_name":"Carol White","current_course":"Algorithms","next_course":"Database Systems"},{"student_name":"Carol White","current_course":"Database Systems","next_course":null},{"student_name":"Dave Brown","current_course":"Mechanics","next_course":"Quantum Physics"},{"student_name":"Dave Brown","current_course":"Quantum Physics","next_course":null},{"student_name":"Eve Davis","current_course":"Calculus I","next_course":"Linear Algebra"},{"student_name":"Eve Davis","current_course":"Linear Algebra","next_course":null},{"student_name":"Frank Wilson","current_course":"Data Structures","next_course":"Algorithms"},{"student_name":"Frank Wilson","current_course":"Algorithms","next_course":"Database Systems"},{"student_name":"Frank Wilson","current_course":"Database Systems","next_course":null},{"student_name":"Grace Lee","current_course":"Mechanics","next_course":"Quantum Physics"},{"student_name":"Grace Lee","current_course":"Quantum Physics","next_course":null},{"student_name":"Henry Clark","current_course":"Calculus I","next_course":"Linear Algebra"},{"student_name":"Henry Clark","current_course":"Linear Algebra","next_course":null}]',
    ].join("\n"),
    source: "spider",
  },

  /* ================================================================ */
  /* CTEs / WITH clauses (4 tasks)                                     */
  /* ================================================================ */

  {
    prompt:
      "Write a SELECT query using a CTE (WITH clause) to first compute the total spent per customer, then from that CTE select only customers who spent more than $1,000. Return customer_name and total_spent. Order by total_spent DESC.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: cte_customer_spending",
      "WITH customer_spending AS (SELECT c.name AS customer_name, SUM(p.price * oi.quantity) AS total_spent FROM customers c INNER JOIN orders o ON c.id = o.customer_id INNER JOIN order_items oi ON o.id = oi.order_id INNER JOIN products p ON oi.product_id = p.id GROUP BY c.id, c.name) SELECT customer_name, total_spent FROM customer_spending WHERE total_spent > 1000 ORDER BY total_spent DESC;",
      '-- EXPECTED: [{"customer_name":"Alice Johnson","total_spent":1710.0},{"customer_name":"Bob Smith","total_spent":1320.0},{"customer_name":"Dave Brown","total_spent":1290.0}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a recursive CTE to traverse the employee management hierarchy starting from the top-level managers (manager_id IS NULL) down to all subordinates. Show the chain of command. Return level (depth), manager_name, and employee_name. Order by level, then manager_name, then employee_name.",
    language: "sql",
    fixture: EMP_FIXTURE,
    hidden_tests: [
      "-- TEST: recursive_cte_org_hierarchy",
      "WITH RECURSIVE org_hierarchy AS (SELECT e.id, e.name, e.manager_id, 0 AS level FROM employees e WHERE e.manager_id IS NULL UNION ALL SELECT e.id, e.name, e.manager_id, oh.level + 1 FROM employees e INNER JOIN org_hierarchy oh ON e.manager_id = oh.id) SELECT oh.level, COALESCE(m.name, 'N/A') AS manager_name, oh.name AS employee_name FROM org_hierarchy oh LEFT JOIN employees m ON oh.manager_id = m.id ORDER BY oh.level, manager_name, employee_name;",
      '-- EXPECTED: [{"level":0,"manager_name":"N/A","employee_name":"Alice Chen"},{"level":0,"manager_name":"N/A","employee_name":"Dave Johnson"},{"level":0,"manager_name":"N/A","employee_name":"Grace Kim"},{"level":0,"manager_name":"N/A","employee_name":"Iris Lopez"},{"level":0,"manager_name":"N/A","employee_name":"Kara Brown"},{"level":1,"manager_name":"Alice Chen","employee_name":"Bob Martinez"},{"level":1,"manager_name":"Alice Chen","employee_name":"Carol Williams"},{"level":1,"manager_name":"Dave Johnson","employee_name":"Eve Thompson"},{"level":1,"manager_name":"Dave Johnson","employee_name":"Frank Garcia"},{"level":1,"manager_name":"Grace Kim","employee_name":"Henry Davis"},{"level":1,"manager_name":"Iris Lopez","employee_name":"Jack Wilson"},{"level":1,"manager_name":"Kara Brown","employee_name":"Liam Taylor"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using a CTE to find the highest-graded course per student (A > A- > B+ > B > B- > C+ > C). Then join with courses to show the course name. Return student_name, course_name, and best_grade. Order by student_name.",
    language: "sql",
    fixture: EDU_FIXTURE,
    hidden_tests: [
      "-- TEST: cte_best_grade_per_student",
      "WITH ranked_grades AS (SELECT e.student_id, e.course_id, e.grade, ROW_NUMBER() OVER (PARTITION BY e.student_id ORDER BY CASE e.grade WHEN 'A' THEN 1 WHEN 'A-' THEN 2 WHEN 'B+' THEN 3 WHEN 'B' THEN 4 WHEN 'B-' THEN 5 WHEN 'C+' THEN 6 WHEN 'C' THEN 7 ELSE 8 END) AS rn FROM enrollments e) SELECT s.name AS student_name, c.name AS course_name, rg.grade AS best_grade FROM ranked_grades rg INNER JOIN students s ON rg.student_id = s.id INNER JOIN courses c ON rg.course_id = c.id WHERE rg.rn = 1 ORDER BY student_name;",
      '-- EXPECTED: [{"student_name":"Alice Johnson","course_name":"Data Structures","best_grade":"A"},{"student_name":"Bob Smith","course_name":"Linear Algebra","best_grade":"A"},{"student_name":"Carol White","course_name":"Algorithms","best_grade":"A"},{"student_name":"Dave Brown","course_name":"Quantum Physics","best_grade":"B-"},{"student_name":"Eve Davis","course_name":"Calculus I","best_grade":"A-"},{"student_name":"Frank Wilson","course_name":"Data Structures","best_grade":"A"},{"student_name":"Grace Lee","course_name":"Quantum Physics","best_grade":"B+"},{"student_name":"Henry Clark","course_name":"Linear Algebra","best_grade":"B-"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using two CTEs: first compute the total quantity sold per product (cte_sales), then compute the average quantity sold across all products (cte_avg). Return product_name, quantity_sold, and avg_across_all. Order by quantity_sold DESC.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: multi_cte_chained",
      "WITH cte_sales AS (SELECT p.name AS product_name, SUM(oi.quantity) AS quantity_sold FROM products p INNER JOIN order_items oi ON p.id = oi.product_id GROUP BY p.id, p.name), cte_avg AS (SELECT AVG(quantity_sold) AS avg_qty FROM cte_sales) SELECT cs.product_name, cs.quantity_sold, ca.avg_qty AS avg_across_all FROM cte_sales cs CROSS JOIN cte_avg ca ORDER BY cs.quantity_sold DESC;",
      '-- EXPECTED: [{"product_name":"Notebook","quantity_sold":15,"avg_across_all":4.625},{"product_name":"Mouse","quantity_sold":6,"avg_across_all":4.625},{"product_name":"Desk Chair","quantity_sold":3,"avg_across_all":4.625},{"product_name":"Desk Lamp","quantity_sold":3,"avg_across_all":4.625},{"product_name":"Laptop","quantity_sold":3,"avg_across_all":4.625},{"product_name":"Pen Set","quantity_sold":3,"avg_across_all":4.625},{"product_name":"Keyboard","quantity_sold":2,"avg_across_all":4.625},{"product_name":"Monitor","quantity_sold":2,"avg_across_all":4.625}]',
    ].join("\n"),
    source: "spider",
  },

  /* ================================================================ */
  /* String / Date operations (5 tasks)                                */
  /* ================================================================ */

  {
    prompt:
      "Write a SELECT query using LIKE to find customers whose email ends with '@email.com'. Return name and email. Order by name.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: like_email_domain",
      "SELECT name, email FROM customers WHERE email LIKE '%@email.com' ORDER BY name;",
      '-- EXPECTED: [{"name":"Alice Johnson","email":"alice@email.com"},{"name":"Bob Smith","email":"bob@email.com"},{"name":"Carol White","email":"carol@email.com"},{"name":"Dave Brown","email":"dave@email.com"},{"name":"Eve Davis","email":"eve@email.com"},{"name":"Frank Wilson","email":"frank@email.com"},{"name":"Grace Lee","email":"grace@email.com"},{"name":"Henry Clark","email":"henry@email.com"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find all orders placed between March 1, 2023 and May 31, 2023 (inclusive). Return order_id, customer_id, order_date, and status. Order by order_date.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: date_range_q1_q2",
      "SELECT id AS order_id, customer_id, order_date, status FROM orders WHERE order_date BETWEEN '2023-03-01' AND '2023-05-31' ORDER BY order_date;",
      '-- EXPECTED: [{"order_id":1,"customer_id":1,"order_date":"2023-03-10","status":"delivered"},{"order_id":6,"customer_id":4,"order_date":"2023-03-20","status":"delivered"},{"order_id":9,"customer_id":6,"order_date":"2023-04-10","status":"delivered"},{"order_id":3,"customer_id":2,"order_date":"2023-04-15","status":"delivered"},{"order_id":7,"customer_id":5,"order_date":"2023-05-05","status":"delivered"},{"order_id":2,"customer_id":1,"order_date":"2023-05-20","status":"delivered"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using string concatenation (the || operator) to return a formatted string for each author in the format: 'Author Name (Nationality)'. Return the formatted string as author_info. Order by author_info.",
    language: "sql",
    fixture: BOOKS_FIXTURE,
    hidden_tests: [
      "-- TEST: string_concat_author",
      "SELECT (name || ' (' || nationality || ')') AS author_info FROM authors ORDER BY author_info;",
      '-- EXPECTED: [{"author_info":"Gabriel Garcia Marquez (Colombian)"},{"author_info":"George Orwell (British)"},{"author_info":"Haruki Murakami (Japanese)"},{"author_info":"J.K. Rowling (British)"},{"author_info":"J.R.R. Tolkien (British)"},{"author_info":"Jane Austen (British)"},{"author_info":"Mark Twain (American)"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using CASE WHEN to categorize books by page count: 'Short' (< 200 pages), 'Medium' (200-400 pages), 'Long' (> 400 pages). Return title, pages, and length_category. Order by pages.",
    language: "sql",
    fixture: BOOKS_FIXTURE,
    hidden_tests: [
      "-- TEST: case_when_length_category",
      "SELECT title, pages, CASE WHEN pages < 200 THEN 'Short' WHEN pages <= 400 THEN 'Medium' ELSE 'Long' END AS length_category FROM books ORDER BY pages;",
      '-- EXPECTED: [{"title":"Animal Farm","pages":112,"length_category":"Short"},{"title":"Norwegian Wood","pages":296,"length_category":"Medium"},{"title":"Harry Potter and the Sorcerers Stone","pages":309,"length_category":"Medium"},{"title":"The Hobbit","pages":310,"length_category":"Medium"},{"title":"1984","pages":328,"length_category":"Medium"},{"title":"Harry Potter and the Chamber of Secrets","pages":341,"length_category":"Medium"},{"title":"Adventures of Huckleberry Finn","pages":366,"length_category":"Medium"},{"title":"One Hundred Years of Solitude","pages":417,"length_category":"Long"},{"title":"Pride and Prejudice","pages":432,"length_category":"Long"},{"title":"Kafka on the Shore","pages":467,"length_category":"Long"},{"title":"The Lord of the Rings","pages":1178,"length_category":"Long"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find customers who registered in the first quarter of 2023 (January through March). Count how many orders each of those customers placed. Return customer_name and order_count. Order by order_count DESC.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: date_filter_q1_registration",
      "SELECT c.name AS customer_name, COUNT(o.id) AS order_count FROM customers c LEFT JOIN orders o ON c.id = o.customer_id WHERE c.registration_date < '2023-04-01' GROUP BY c.id, c.name ORDER BY order_count DESC;",
      '-- EXPECTED: [{"customer_name":"Alice Johnson","order_count":2},{"customer_name":"Carol White","order_count":2},{"customer_name":"Eve Davis","order_count":2},{"customer_name":"Bob Smith","order_count":1},{"customer_name":"Dave Brown","order_count":1},{"customer_name":"Grace Lee","order_count":1}]',
    ].join("\n"),
    source: "spider",
  },

  /* ================================================================ */
  /* Set operations (5 tasks)                                          */
  /* ================================================================ */

  {
    prompt:
      "Write a SELECT query using UNION to combine the list of all student names and all professor names into a single list. Return person_name and a label column called role ('Student' or 'Professor'). Order by person_name.",
    language: "sql",
    fixture: EDU_FIXTURE,
    hidden_tests: [
      "-- TEST: union_students_professors",
      "SELECT name AS person_name, 'Student' AS role FROM students UNION SELECT name, 'Professor' FROM professors ORDER BY person_name;",
      '-- EXPECTED: [{"person_name":"Alice Johnson","role":"Student"},{"person_name":"Bob Smith","role":"Student"},{"person_name":"Carol White","role":"Student"},{"person_name":"Dave Brown","role":"Student"},{"person_name":"Dr. Adams","role":"Professor"},{"person_name":"Dr. Baker","role":"Professor"},{"person_name":"Dr. Chen","role":"Professor"},{"person_name":"Dr. Diaz","role":"Professor"},{"person_name":"Eve Davis","role":"Student"},{"person_name":"Frank Wilson","role":"Student"},{"person_name":"Grace Lee","role":"Student"},{"person_name":"Henry Clark","role":"Student"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using INTERSECT to find customers who have placed orders in both March 2023 and May 2023. Return customer_name. Order by customer_name.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: intersect_march_and_may",
      "SELECT c.name AS customer_name FROM customers c INNER JOIN orders o1 ON c.id = o1.customer_id WHERE o1.order_date LIKE '2023-03-%' INTERSECT SELECT c.name FROM customers c INNER JOIN orders o2 ON c.id = o2.customer_id WHERE o2.order_date LIKE '2023-05-%' ORDER BY customer_name;",
      '-- EXPECTED: [{"customer_name":"Alice Johnson"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using EXCEPT to find customers who registered in 2023 Q1 (before April) but have never placed an order. Return customer_name and registration_date. Order by customer_name.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: except_registered_no_orders",
      "SELECT c.name AS customer_name, c.registration_date FROM customers c WHERE c.registration_date < '2023-04-01' EXCEPT SELECT c.name, c.registration_date FROM customers c INNER JOIN orders o ON c.id = o.customer_id ORDER BY customer_name;",
      "-- EXPECTED: []",
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query using UNION ALL to combine student names from Computer Science and Mathematics majors (include duplicates if any). Return student_name and major. Order by major, then student_name.",
    language: "sql",
    fixture: EDU_FIXTURE,
    hidden_tests: [
      "-- TEST: union_all_cs_math",
      "SELECT name AS student_name, major FROM students WHERE major = 'Computer Science' UNION ALL SELECT name, major FROM students WHERE major = 'Mathematics' ORDER BY major, student_name;",
      '-- EXPECTED: [{"student_name":"Alice Johnson","major":"Computer Science"},{"student_name":"Carol White","major":"Computer Science"},{"student_name":"Frank Wilson","major":"Computer Science"},{"student_name":"Bob Smith","major":"Mathematics"},{"student_name":"Eve Davis","major":"Mathematics"},{"student_name":"Henry Clark","major":"Mathematics"}]',
    ].join("\n"),
    source: "spider",
  },
  {
    prompt:
      "Write a SELECT query to find products that have been ordered by both customer Alice Johnson (id=1) and customer Carol White (id=3). Use INTERSECT. Return product_name. Order by product_name.",
    language: "sql",
    fixture: ECOM_FIXTURE,
    hidden_tests: [
      "-- TEST: intersect_products_two_customers",
      "SELECT p.name AS product_name FROM products p INNER JOIN order_items oi ON p.id = oi.product_id INNER JOIN orders o ON oi.order_id = o.id WHERE o.customer_id = 1 INTERSECT SELECT p.name FROM products p INNER JOIN order_items oi ON p.id = oi.product_id INNER JOIN orders o ON oi.order_id = o.id WHERE o.customer_id = 3 ORDER BY product_name;",
      '-- EXPECTED: [{"product_name":"Mouse"}]',
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

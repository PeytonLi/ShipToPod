import { describe, it, expect } from "vitest";
import { decodeByteBpe } from "./deepseek";

const G = "Ġ"; // GPT-2 byte-BPE marker for a space
const C = "Ċ"; // GPT-2 byte-BPE marker for a newline

describe("decodeByteBpe — reverses leaked GPT-2 byte-level BPE", () => {
  it("decodes the space marker (Ġ) back to real spaces", () => {
    expect(decodeByteBpe(`Here${G}is${G}the${G}SQL`)).toBe("Here is the SQL");
  });

  it("decodes newlines (Ċ) and four-space indentation", () => {
    const encoded = `def${G}add(a,${G}b):${C}${G}${G}${G}${G}return${G}a${G}+${G}b`;
    expect(decodeByteBpe(encoded)).toBe("def add(a, b):\n    return a + b");
  });

  it("repairs a leaked SQL completion", () => {
    const encoded = `SELECT${G}*${G}FROM${G}customers${G}WHERE${G}id${G}=${G}1;`;
    expect(decodeByteBpe(encoded)).toBe("SELECT * FROM customers WHERE id = 1;");
  });

  it("leaves already-clean text unchanged", () => {
    const clean = "SELECT * FROM customers WHERE id = 1;";
    expect(decodeByteBpe(clean)).toBe(clean);
  });

  it("is a no-op on an empty string", () => {
    expect(decodeByteBpe("")).toBe("");
  });
});

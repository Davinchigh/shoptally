import { describe, expect, it } from "vitest";
import { cartTotal, ghs, toPesewas } from "./money";

describe("ghs", () => {
  it("formats pesewas as cedis", () => {
    expect(ghs(4500)).toBe("GHS 45.00");
    expect(ghs(125005)).toBe("GHS 1,250.05");
    expect(ghs(-7100)).toBe("-GHS 71.00");
    expect(ghs(0)).toBe("GHS 0.00");
  });
});

describe("toPesewas", () => {
  it("reads what people type", () => {
    expect(toPesewas("45")).toBe(4500);
    expect(toPesewas("12.5")).toBe(1250);
    expect(toPesewas("1,200.50")).toBe(120050);
    expect(toPesewas("GHS 3.80")).toBe(380);
  });
  it("rejects nonsense and zero", () => {
    expect(toPesewas("")).toBeNull();
    expect(toPesewas("abc")).toBeNull();
    expect(toPesewas("1.234")).toBeNull();
    expect(toPesewas("0")).toBeNull();
  });
});

describe("cartTotal", () => {
  it("adds line totals without float drift", () => {
    expect(cartTotal([{ productId: 1, quantity: 3, price: 10 }, { productId: 2, quantity: 1, price: 20 }])).toBe(50);
  });
});

describe("amount", () => {
  it("drops the currency but keeps separators and sign", async () => {
    const { amount } = await import("./money");
    expect(amount(41200)).toBe("412.00");
    expect(amount(1234567)).toBe("12,345.67");
    expect(amount(-7100)).toBe("-71.00");
  });
});

import { describe, expect, it } from "vitest";
import { splitAfterMandatory } from "./split";

describe("splitAfterMandatory", () => {
  it("takes the real mandatory payments first and splits the rest 60/40", () => {
    expect(splitAfterMandatory(3000, 1400, 500)).toEqual({
      essentials: 1400,
      discretionary: 960,
      savings: 640,
      essentialsSpent: 500,
      discretionarySpent: 0,
    });
  });
  it("counts spending beyond the mandatory total as everyday spending", () => {
    const s = splitAfterMandatory(3000, 1400, 2000);
    expect(s.essentialsSpent).toBe(1400);
    expect(s.discretionarySpent).toBe(600);
  });
  it("leaves nothing to split when mandatory payments exceed the income", () => {
    const s = splitAfterMandatory(1000, 1286.48, 0);
    expect(s).toMatchObject({ essentials: 1286.48, discretionary: 0, savings: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { upcoming, whenLabel, type Payment } from "./api";

const p = (id: number, inDays: number, active = true): Payment => ({
  id,
  title: `p${id}`,
  amount: 10,
  currency: "GEL",
  category: null,
  dueDay: 1,
  active,
  next: { iso: "2026-11-10", inDays },
});

describe("payments helpers", () => {
  it("labels the time left", () => {
    expect(whenLabel(0)).toBe("сегодня");
    expect(whenLabel(1)).toBe("завтра");
    expect(whenLabel(6)).toBe("через 6 дн.");
  });

  it("returns active payments, nearest first", () => {
    expect(upcoming([p(1, 9), p(2, 0, false), p(3, 2), p(4, 5)], 2).map((x) => x.id)).toEqual([3, 4]);
  });
});

import { describe, expect, it } from "vitest";
import { daysLabel } from "./TodayCard";

describe("daysLabel", () => {
  it("declines «день» correctly", () => {
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 111].map(daysLabel)).toEqual([
      "1 день",
      "2 дня",
      "4 дня",
      "5 дней",
      "11 дней",
      "12 дней",
      "14 дней",
      "21 день",
      "22 дня",
      "25 дней",
      "111 дней",
    ]);
  });
});

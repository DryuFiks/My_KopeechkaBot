import { describe, expect, it } from "vitest";
import { digestTip, formatWeeklyDigest, isDigestDue, nearLimits, type DigestData } from "./weeklyDigest";

const now = new Date("2026-11-08T15:30:00Z"); // Sunday 19:30 in Tbilisi
const due = {
  enabled: true,
  weekday: 7,
  localHour: 19,
  todayIso: "2026-11-08",
  lastSentIso: "2026-11-01",
  lastActiveAt: new Date("2026-11-07T10:00:00Z"),
  now,
};

describe("isDigestDue", () => {
  it("sends on Sunday from 19:00 once", () => {
    expect(isDigestDue(due)).toBe(true);
    expect(isDigestDue({ ...due, lastSentIso: "2026-11-08" })).toBe(false);
  });

  it("is off by default, on other days and before 19:00", () => {
    expect(isDigestDue({ ...due, enabled: false })).toBe(false);
    expect(isDigestDue({ ...due, weekday: 6 })).toBe(false);
    expect(isDigestDue({ ...due, localHour: 18 })).toBe(false);
  });

  it("skips users inactive for two weeks", () => {
    expect(isDigestDue({ ...due, lastActiveAt: new Date("2026-10-20T10:00:00Z") })).toBe(false);
    expect(isDigestDue({ ...due, lastActiveAt: null })).toBe(false);
  });
});

const data: DigestData = {
  weekGel: 600,
  prevWeekGel: 400,
  topCategories: [
    { category: "Кафе", amountGel: 250 },
    { category: null, amountGel: 150 },
    { category: "Еда <3", amountGel: 120 },
    { category: "Такси", amountGel: 80 },
  ],
  limits: [
    { category: "Кафе", spentGel: 320, limitGel: 300 },
    { category: "Еда", spentGel: 460, limitGel: 500 },
    { category: "Транспорт", spentGel: 20, limitGel: 120 },
  ],
  goal: { title: "Отпуск", savedGel: 400, targetGel: 2000 },
};

describe("weekly digest content", () => {
  it("lists categories at 90% of the limit or more, fullest first", () => {
    expect(nearLimits(data.limits).map((l) => l.category)).toEqual(["Кафе", "Еда"]);
  });

  it("picks the most useful tip", () => {
    expect(digestTip(data)).toContain("«Кафе» уже выше лимита");
    expect(digestTip({ ...data, limits: [] })).toContain("больше чем на 20%");
    expect(digestTip({ ...data, limits: [], prevWeekGel: 600 })).toContain(
      "До цели «Отпуск» осталось 1600.00 GEL",
    );
    expect(digestTip({ ...data, limits: [], prevWeekGel: 600, goal: null })).toBe(
      "Неделя ровная — так держать.",
    );
  });

  it("formats the message: change, top 3, limits, goal, tip; HTML escaped", () => {
    const text = formatWeeklyDigest(data);
    expect(text).toContain("на 50% больше прошлой");
    expect(text).toContain("• Без категории — 150.00 GEL");
    expect(text).toContain("Еда &lt;3");
    expect(text).not.toContain("Такси");
    expect(text).toContain("Кафе — 320.00 GEL из 300.00 GEL");
    expect(text).toContain("Цель «Отпуск»: 20%");
  });
});

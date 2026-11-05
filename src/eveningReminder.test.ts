import { describe, expect, it } from "vitest";
import { isEveningReminderDue } from "./eveningReminder";

const now = new Date("2026-11-04T17:30:00Z"); // 21:30 in Tbilisi
const dayStart = new Date("2026-11-03T20:00:00Z"); // 00:00 of 4 Nov in Tbilisi
const base = {
  enabled: true,
  remindHour: 21,
  localHour: 21,
  todayIso: "2026-11-04",
  lastNotifiedIso: "2026-11-03",
  dayStart,
  lastRecordAt: new Date("2026-11-03T15:00:00Z"),
  lastActiveAt: new Date("2026-11-03T15:00:00Z"),
  now,
};

describe("isEveningReminderDue", () => {
  it("reminds an active user with nothing recorded today, at or after their hour", () => {
    expect(isEveningReminderDue(base)).toBe(true);
    expect(isEveningReminderDue({ ...base, localHour: 23 })).toBe(true);
  });

  it("is off by default and before the hour", () => {
    expect(isEveningReminderDue({ ...base, enabled: false })).toBe(false);
    expect(isEveningReminderDue({ ...base, localHour: 20 })).toBe(false);
  });

  it("sends at most once a day", () => {
    expect(isEveningReminderDue({ ...base, lastNotifiedIso: "2026-11-04" })).toBe(false);
  });

  it("stays quiet when something is already recorded today", () => {
    expect(isEveningReminderDue({ ...base, lastRecordAt: new Date("2026-11-04T06:00:00Z") })).toBe(false);
    expect(isEveningReminderDue({ ...base, lastRecordAt: dayStart })).toBe(false);
  });

  it("does not nag users inactive for more than two weeks", () => {
    expect(isEveningReminderDue({ ...base, lastActiveAt: new Date("2026-10-20T17:00:00Z") })).toBe(false);
    expect(isEveningReminderDue({ ...base, lastActiveAt: null, lastRecordAt: null })).toBe(false);
  });
});

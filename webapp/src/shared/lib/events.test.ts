import { describe, expect, it } from "vitest";
import { createBus } from "./events";

describe("createBus", () => {
  it("delivers values to every listener until unsubscribed", () => {
    const bus = createBus<number>();
    const seen: number[] = [];
    const off = bus.on((v) => seen.push(v));
    bus.on((v) => seen.push(v * 10));
    bus.emit(1);
    off();
    bus.emit(2);
    expect(seen).toEqual([1, 10, 20]);
  });
  it("tolerates a listener unsubscribing during emit", () => {
    const bus = createBus<void>();
    let calls = 0;
    const off = bus.on(() => {
      calls++;
      off();
    });
    bus.on(() => calls++);
    bus.emit();
    bus.emit();
    expect(calls).toBe(3);
  });
});

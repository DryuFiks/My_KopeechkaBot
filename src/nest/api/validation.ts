import { BadRequestException } from "@nestjs/common";
import { isSupportedCurrency, type SupportedCurrency } from "../../currencies";

export function money(value: unknown, { allowZero = true, max = 1e9 } = {}): number {
  const n = Number(value);
  if (value === null || value === "" || !Number.isFinite(n) || n < 0 || n > max || (!allowZero && n === 0)) {
    throw new BadRequestException("invalid amount");
  }
  return Math.round(n * 100) / 100;
}

export function optionalMoney(value: unknown): number | null {
  return value === undefined || value === null || value === "" ? null : money(value);
}

export function currency(value: unknown): SupportedCurrency {
  if (typeof value !== "string" || !isSupportedCurrency(value))
    throw new BadRequestException("invalid currency");
  return value.toUpperCase() as SupportedCurrency;
}

export function name(value: unknown, max = 60): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s || s.length > max) throw new BadRequestException("invalid name");
  return s;
}

export function optionalDay(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 31) throw new BadRequestException("invalid day");
  return n;
}

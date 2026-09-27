import { isSupportedCurrency, SupportedCurrency } from "./currency";

export type TransactionType = "expense" | "income";

export interface ParsedTransaction {
  type: TransactionType;
  amount: number;
  currency: SupportedCurrency;
  category: string | null;
  note: string | null;
}

export interface ParseError {
  error: string;
}

export type ParseResult = ParsedTransaction | ParseError;

export function isParseError(result: ParseResult): result is ParseError {
  return (result as ParseError).error !== undefined;
}

const DEFAULT_CURRENCY: SupportedCurrency = "GEL";

// Matches: sign, amount (dot or comma decimal), rest of the line.
const LINE_PATTERN = /^([+-])\s*(\d+(?:[.,]\d+)?)\s*(.*)$/s;

// A 3-letter latin token right after the amount is treated as an attempted
// currency code (so "-10 xyz" is rejected rather than silently becoming a
// category called "xyz").
const CURRENCY_TOKEN_PATTERN = /^[a-zA-Z]{3}$/;

/**
 * Parses a single free-text message into a transaction, or returns an error.
 * Does not touch the database — pure function, testable in isolation.
 */
export function parseTransactionMessage(rawText: string): ParseResult {
  const text = rawText.trim();

  if (text.length === 0) {
    return { error: "Пустое сообщение. Пример: -150 gel еда обед" };
  }

  const match = LINE_PATTERN.exec(text);
  if (!match) {
    return {
      error:
        "Не понял формат. Начни с + (доход) или - (расход), затем сумма. Пример: -150 gel еда обед",
    };
  }

  const [, sign, rawAmount, rest] = match;
  const type: TransactionType = sign === "-" ? "expense" : "income";

  const amount = parseFloat(rawAmount.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Сумма должна быть числом больше нуля." };
  }

  const restTrimmed = rest.trim();
  const tokens = restTrimmed.length > 0 ? restTrimmed.split(/\s+/) : [];

  let currency: SupportedCurrency = DEFAULT_CURRENCY;
  let contentTokens = tokens;

  if (tokens.length > 0 && CURRENCY_TOKEN_PATTERN.test(tokens[0])) {
    const candidate = tokens[0].toUpperCase();
    if (!isSupportedCurrency(candidate)) {
      return {
        error: `Неизвестная валюта "${tokens[0]}". Поддерживаются: RUB, GEL, USD.`,
      };
    }
    currency = candidate as SupportedCurrency;
    contentTokens = tokens.slice(1);
  }

  const category = contentTokens.length > 0 ? contentTokens[0] : null;
  const note = contentTokens.length > 1 ? contentTokens.slice(1).join(" ") : null;

  return { type, amount, currency, category, note };
}

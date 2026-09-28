import { describe, expect, it } from "vitest";
import { UserInputError, messageForError } from "./safe";

describe("messageForError", () => {
  it("shows a UserInputError's own message verbatim", () => {
    expect(messageForError(new UserInputError("Сумма должна быть больше нуля."))).toBe(
      "Сумма должна быть больше нуля.",
    );
  });

  it("maps a connection failure to the transient-error message", () => {
    expect(messageForError(new Error("connect ECONNREFUSED 127.0.0.1:5432"))).toBe(
      "Временная проблема с базой данных. Попробуй ещё раз через минуту.",
    );
  });

  it("maps a query timeout to the transient-error message", () => {
    expect(messageForError(new Error("Query read timeout"))).toBe(
      "Временная проблема с базой данных. Попробуй ещё раз через минуту.",
    );
  });

  it("never leaks the raw error message for an unexpected internal error", () => {
    const text = messageForError(new Error('relation "transactions" does not exist, password=secret'));
    expect(text).toBe("Что-то пошло не так. Попробуй ещё раз чуть позже.");
    expect(text).not.toContain("password");
    expect(text).not.toContain("secret");
  });

  it("handles a non-Error throw without crashing", () => {
    expect(messageForError("plain string failure")).toBe("Что-то пошло не так. Попробуй ещё раз чуть позже.");
  });
});

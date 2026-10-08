import { describe, expect, it } from "vitest";
import { errorMessage } from "./client";

describe("errorMessage", () => {
  it("maps known statuses to friendly text and never echoes server text", () => {
    expect(errorMessage(401)).toContain("Telegram");
    expect(errorMessage(400)).toBe("Проверьте введённые данные");
    expect(errorMessage(404)).toBe("Запись не найдена");
    expect(errorMessage(500)).toBe("Ошибка 500");
  });
});

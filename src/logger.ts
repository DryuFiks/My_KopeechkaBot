import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";

type Level = "INFO" | "WARN" | "ERROR";

const LOG_DIR = join(process.cwd(), "logs");

// Never let a stray BOT_TOKEN or DATABASE_URL end up in a log line.
const SECRET_PATTERNS = [/BOT_TOKEN\s*=\s*\S+/gi, /postgres(?:ql)?:\/\/\S+/gi];

function ensureLogDir(): void {
  try {
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch {
    // If the directory can't be created, console logging below still works.
  }
}
ensureLogDir();

function currentLogFile(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD — one file per day
  return join(LOG_DIR, `bot-${date}.log`);
}

function redact(message: string): string {
  let result = message;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[redacted]");
  }
  return result;
}

function write(level: Level, message: string): void {
  const line = `${new Date().toISOString()} [${level}] ${redact(message)}`;

  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);

  try {
    ensureLogDir();
    appendFileSync(currentLogFile(), line + "\n", "utf-8");
  } catch {
    // File logging failed — console output above still captured it.
  }
}

export const logger = {
  info: (message: string) => write("INFO", message),
  warn: (message: string) => write("WARN", message),
  error: (message: string) => write("ERROR", message),
};

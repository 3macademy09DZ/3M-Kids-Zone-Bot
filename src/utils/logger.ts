type LogLevel = "info" | "warn" | "error" | "debug";

const SENSITIVE_KEYS = ["token", "password", "secret", "authorization"];

function sanitizeMessage(message: string): string {
  let sanitized = message;
  for (const key of SENSITIVE_KEYS) {
    const regex = new RegExp(`(${key}[=:\\s]+)[^\\s,}]+`, "gi");
    sanitized = sanitized.replace(regex, `$1[REDACTED]`);
  }
  return sanitized;
}

function formatArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg === "string") return sanitizeMessage(arg);
    if (arg instanceof Error) {
      return sanitizeMessage(arg.message);
    }
    return arg;
  });
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const safeMessage = sanitizeMessage(message);
  const safeArgs = formatArgs(args);

  switch (level) {
    case "error":
      console.error(prefix, safeMessage, ...safeArgs);
      break;
    case "warn":
      console.warn(prefix, safeMessage, ...safeArgs);
      break;
    case "debug":
      console.debug(prefix, safeMessage, ...safeArgs);
      break;
    default:
      console.log(prefix, safeMessage, ...safeArgs);
  }
}

export const logger = {
  info: (message: string, ...args: unknown[]) => log("info", message, ...args),
  warn: (message: string, ...args: unknown[]) => log("warn", message, ...args),
  error: (message: string, ...args: unknown[]) => log("error", message, ...args),
  debug: (message: string, ...args: unknown[]) => log("debug", message, ...args),
};

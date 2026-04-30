import path from "node:path";
import { AppConfig } from "../types";

const parseAllowedUserIds = (value: string): number[] => {
  const ids = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((num) => Number.isFinite(num));

  return Array.from(new Set(ids));
};

const must = (value: string | undefined, key: string): string => {
  if (!value || !value.trim()) {
    throw new Error(`Missing required env variable: ${key}`);
  }
  return value.trim();
};

export const loadConfig = (): AppConfig => {
  const telegramBotToken = must(process.env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN");
  const cursorApiKey = must(process.env.CURSOR_API_KEY, "CURSOR_API_KEY");
  const cursorModelId = must(process.env.CURSOR_MODEL_ID, "CURSOR_MODEL_ID");
  const grokApiKey = must(process.env.GROK_API_KEY, "GROK_API_KEY");
  const grokModelId = must(process.env.GROK_MODEL_ID, "GROK_MODEL_ID");
  const grokBaseUrl = (process.env.GROK_BASE_URL ?? "https://api.x.ai/v1").trim();
  const telegramAllowedUserIds = parseAllowedUserIds(
    process.env.TELEGRAM_ALLOWED_USER_IDS ?? ""
  );

  if (telegramAllowedUserIds.length === 0) {
    throw new Error(
      "TELEGRAM_ALLOWED_USER_IDS must contain at least one Telegram numeric user id."
    );
  }

  const jobsFilePath = path.resolve(process.cwd(), "src/data/jobs.json");
  const heartbeatIntervalMs = 60_000;
  const a2aCardsFilePath = path.resolve(process.cwd(), "src/data/a2a-cards.json");

  return {
    telegramBotToken,
    telegramAllowedUserIds,
    cursorApiKey,
    cursorModelId,
    grokApiKey,
    grokModelId,
    grokBaseUrl,
    jobsFilePath,
    heartbeatIntervalMs,
    a2aCardsFilePath
  };
};

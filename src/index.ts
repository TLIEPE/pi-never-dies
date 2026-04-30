import { Actions } from "./actions";
import { A2AClient } from "./a2aClient";
import { CursorClient } from "./cursorClient";
import { GrokClient } from "./grokClient";
import { JobManager } from "./jobManager";
import { buildTelegramBot } from "./telegramHandler";
import { loadConfig } from "./utils/env";
import { logger } from "./utils/logger";

const ensureRipgrepForCursorSdk = (): void => {
  const configured = process.env.CURSOR_RIPGREP_PATH?.trim();
  const ripgrepPath = configured && configured.length > 0 ? configured : "/usr/bin/rg";
  process.env.CURSOR_RIPGREP_PATH = ripgrepPath;

  const currentPath = process.env.PATH ?? "";
  const rgDir = ripgrepPath.includes("/") ? ripgrepPath.slice(0, ripgrepPath.lastIndexOf("/")) : "";
  if (!rgDir) {
    return;
  }

  const parts = currentPath.split(":").filter(Boolean);
  if (!parts.includes(rgDir)) {
    process.env.PATH = [rgDir, ...parts].join(":");
  }
};

const bootstrap = async (): Promise<void> => {
  ensureRipgrepForCursorSdk();
  const config = loadConfig();

  const jobManager = new JobManager(config.jobsFilePath, config.chatMemoryFilePath);
  await jobManager.ensureStore();

  const a2aClient = new A2AClient(config.a2aCardsFilePath);
  await a2aClient.ensureCardsFile();

  const cursorClient = new CursorClient(config.cursorApiKey, config.cursorModelId);
  const grokClient = new GrokClient(config.grokApiKey, config.grokModelId, config.grokBaseUrl);
  const actions = new Actions(jobManager, a2aClient, cursorClient, grokClient);

  const bot = buildTelegramBot({
    botToken: config.telegramBotToken,
    allowedUserIds: config.telegramAllowedUserIds,
    actions,
    jobManager,
    a2aClient
  });

  setInterval(async () => {
    try {
      await jobManager.setHeartbeatNow();
      logger.info("Heartbeat check complete");
    } catch (error) {
      logger.error("Heartbeat failed", error);
    }
  }, config.heartbeatIntervalMs);

  bot.catch((error, ctx) => {
    logger.error(`Telegram bot error for update ${ctx.update.update_id}`, error);
  });

  await bot.launch();
  logger.info("pi-never-dies is online and listening on Telegram.");

  const shutdown = async (signal: string): Promise<void> => {
    logger.warn(`Received ${signal}, shutting down.`);
    bot.stop(signal);
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
};

void bootstrap().catch((error) => {
  logger.error("Fatal startup error", error);
  process.exit(1);
});

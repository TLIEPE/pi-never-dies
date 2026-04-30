import { Actions } from "./actions";
import { A2AClient } from "./a2aClient";
import { CursorClient } from "./cursorClient";
import { JobManager } from "./jobManager";
import { buildTelegramBot } from "./telegramHandler";
import { loadConfig } from "./utils/env";
import { logger } from "./utils/logger";

const bootstrap = async (): Promise<void> => {
  const config = loadConfig();

  const jobManager = new JobManager(config.jobsFilePath);
  await jobManager.ensureStore();

  const a2aClient = new A2AClient(config.a2aCardsFilePath);
  await a2aClient.ensureCardsFile();

  const cursorClient = new CursorClient(config.cursorApiKey, config.cursorModelId);
  const actions = new Actions(jobManager, a2aClient, cursorClient);

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

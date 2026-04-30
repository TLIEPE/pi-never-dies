import { Telegraf } from "telegraf";
import { Actions } from "./actions";
import { A2AClient } from "./a2aClient";
import { JobManager } from "./jobManager";
import { logger } from "./utils/logger";

const helpText = [
  "🤖 *pi-never-dies* commands",
  "",
  "`/help` - Show command overview",
  "`/chatmode` - Show current chat mode",
  "`/chatmode <cursor|local>` - Switch free-chat engine",
  "`/cards` - List available A2A cards",
  "`/jobs` - List latest jobs",
  "`/status` - Show orchestrator status",
  "`/heartbeat` - Show last heartbeat timestamp",
  "`/plan <text>` - Ask Cursor brain for an action plan",
  "`/job <cardId> | <description>` - Create and run one job via A2A"
].join("\n");

const friendlyError = "Etwas ist schiefgelaufen. Bitte versuche es gleich erneut 🙏";

export const buildTelegramBot = (input: {
  botToken: string;
  allowedUserIds: number[];
  actions: Actions;
  jobManager: JobManager;
  a2aClient: A2AClient;
}): Telegraf => {
  const bot = new Telegraf(input.botToken);
  const allowedUserIds = new Set(input.allowedUserIds);

  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !allowedUserIds.has(userId)) {
      await ctx.reply("Dieser Bot ist privat. Zugriff verweigert.");
      return;
    }
    await next();
  });

  bot.start(async (ctx) => {
    await ctx.replyWithMarkdown(
      [
        "👋 Willkommen bei *pi-never-dies*",
        "",
        "Ich orchestriere deine Agenten über A2A-Cards.",
        "Nutze `/help` für alle Befehle."
      ].join("\n")
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.replyWithMarkdown(helpText);
  });

  bot.command("chatmode", async (ctx) => {
    try {
      const modeInput = ctx.message.text.replace("/chatmode", "").trim().toLowerCase();
      if (!modeInput) {
        const currentMode = await input.actions.getChatMode();
        await ctx.replyWithMarkdown(`🎛️ Aktueller Chat-Mode: *${currentMode}*`);
        return;
      }
      if (modeInput !== "cursor" && modeInput !== "local") {
        await ctx.replyWithMarkdown("Bitte nutze: `/chatmode cursor` oder `/chatmode local`");
        return;
      }
      await input.actions.setChatMode(modeInput);
      await ctx.replyWithMarkdown(`✅ Chat-Mode gewechselt auf: *${modeInput}*`);
    } catch (error) {
      logger.error("Failed to handle /chatmode", error);
      await ctx.reply(friendlyError);
    }
  });

  bot.command("cards", async (ctx) => {
    try {
      const cards = await input.a2aClient.listCards();
      if (cards.length === 0) {
        await ctx.replyWithMarkdown("📭 Keine A2A-Cards gefunden.");
        return;
      }
      const message = cards
        .map(
          (card) =>
            `• *${card.id}* - ${card.name}\n  _${card.description}_\n  Capabilities: \`${card.capabilities.join(", ")}\``
        )
        .join("\n\n");
      await ctx.replyWithMarkdown(`🧩 *A2A-Cards*\n\n${message}`);
    } catch (error) {
      logger.error("Failed to handle /cards", error);
      await ctx.reply(friendlyError);
    }
  });

  bot.command("jobs", async (ctx) => {
    try {
      const jobs = await input.jobManager.listJobs();
      if (jobs.length === 0) {
        await ctx.replyWithMarkdown("🗂️ Es gibt noch keine Jobs.");
        return;
      }
      const latest = jobs.slice(0, 10);
      const message = latest
        .map(
          (job) =>
            `• *${job.id.slice(0, 8)}* \`${job.status}\`\n  ${job.title}\n  updated: ${new Date(job.updatedAt).toLocaleString()}`
        )
        .join("\n\n");
      await ctx.replyWithMarkdown(`📌 *Letzte Jobs*\n\n${message}`);
    } catch (error) {
      logger.error("Failed to handle /jobs", error);
      await ctx.reply(friendlyError);
    }
  });

  bot.command("status", async (ctx) => {
    try {
      const runningJobs = await input.jobManager.getRunningJobsCount();
      const heartbeat = await input.jobManager.getHeartbeat();
      const heartbeatText = heartbeat ? new Date(heartbeat).toLocaleString() : "Noch kein Heartbeat";
      await ctx.replyWithMarkdown(
        [
          "🟢 *Orchestrator Status*",
          "",
          "System: `online`",
          `Running jobs: *${runningJobs}*`,
          `Last heartbeat: _${heartbeatText}_`
        ].join("\n")
      );
    } catch (error) {
      logger.error("Failed to handle /status", error);
      await ctx.reply(friendlyError);
    }
  });

  bot.command("heartbeat", async (ctx) => {
    try {
      const heartbeat = await input.jobManager.getHeartbeat();
      if (!heartbeat) {
        await ctx.replyWithMarkdown("💓 Noch kein Heartbeat vorhanden.");
        return;
      }
      await ctx.replyWithMarkdown(
        `💓 Letzter Heartbeat: _${new Date(heartbeat).toLocaleString()}_`
      );
    } catch (error) {
      logger.error("Failed to handle /heartbeat", error);
      await ctx.reply(friendlyError);
    }
  });

  bot.command("plan", async (ctx) => {
    try {
      const text = ctx.message.text.replace("/plan", "").trim();
      if (!text) {
        await ctx.replyWithMarkdown("Bitte sende: `/plan <deine Aufgabe>`");
        return;
      }
      await ctx.replyWithMarkdown("🧠 Denke nach... ich baue einen Plan mit Cursor SDK.");
      const plan = await input.actions.handlePlanningRequest(text);
      await ctx.replyWithMarkdown(`✅ *Plan*\n\n${plan}`);
    } catch (error) {
      logger.error("Failed to handle /plan", error);
      await ctx.reply(friendlyError);
    }
  });

  bot.command("job", async (ctx) => {
    try {
      const payload = ctx.message.text.replace("/job", "").trim();
      const [cardIdRaw, descriptionRaw] = payload.split("|").map((part) => part.trim());

      if (!cardIdRaw || !descriptionRaw) {
        await ctx.replyWithMarkdown(
          "Bitte sende: `/job <cardId> | <beschreibung>`\nBeispiel: `/job azure-worker | Daten syncen`"
        );
        return;
      }

      const job = await input.actions.createJobFromText(descriptionRaw, cardIdRaw);
      await ctx.replyWithMarkdown(
        `🛠️ Job erstellt: *${job.id.slice(0, 8)}*\nStarte Ausführung über A2A-Card \`${cardIdRaw}\`...`
      );
      const finished = await input.actions.runJob(job.id);

      if (finished.status === "completed") {
        await ctx.replyWithMarkdown(`✅ Job *${finished.id.slice(0, 8)}* erfolgreich abgeschlossen.`);
      } else {
        await ctx.replyWithMarkdown(
          `❌ Job *${finished.id.slice(0, 8)}* fehlgeschlagen.\nGrund: ${
            finished.error ?? "unbekannter Fehler"
          }`
        );
      }
    } catch (error) {
      logger.error("Failed to handle /job", error);
      await ctx.reply(friendlyError);
    }
  });

  bot.on("text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) {
      return;
    }
    try {
      const reply = await input.actions.chat(ctx.message.text);
      const safeReply = reply.length > 3500 ? `${reply.slice(0, 3500)}...` : reply;
      await ctx.replyWithMarkdown(`💬 ${safeReply}`);
    } catch (error) {
      logger.error("Failed to handle freestyle chat", error);
      await ctx.reply(
        "Ich konnte gerade nicht antworten. Prüfe bitte den Chat-Mode und die A2A-Card-Verbindung."
      );
    }
  });

  return bot;
};

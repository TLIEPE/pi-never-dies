import { A2AClient } from "./a2aClient";
import { CursorClient } from "./cursorClient";
import { GrokClient } from "./grokClient";
import { JobManager } from "./jobManager";
import { ChatHistoryEntry, ChatMode, Job } from "./types";

export class Actions {
  constructor(
    private readonly jobManager: JobManager,
    private readonly a2aClient: A2AClient,
    private readonly cursorClient: CursorClient,
    private readonly grokClient: GrokClient
  ) {}

  async handlePlanningRequest(prompt: string): Promise<string> {
    const cards = await this.a2aClient.listCards();
    const jobs = await this.jobManager.listJobs();
    const plan = await this.cursorClient.createExecutionPlan(prompt, cards, jobs);
    return plan;
  }

  async createJobFromText(text: string, targetAgentCardId?: string): Promise<Job> {
    const title = text.length > 80 ? `${text.slice(0, 77)}...` : text;
    return this.jobManager.createJob({
      title,
      description: text,
      targetAgentCardId
    });
  }

  async runJob(jobId: string): Promise<Job> {
    const jobs = await this.jobManager.listJobs();
    const job = jobs.find((entry) => entry.id === jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    if (!job.targetAgentCardId) {
      return this.jobManager.updateJobStatus(job.id, "failed", {
        error: "No A2A target card configured for this job."
      });
    }

    await this.jobManager.updateJobStatus(job.id, "running");

    const response = await this.a2aClient.invokeCard(job.targetAgentCardId, {
      action: "execute-job",
      payload: {
        jobId: job.id,
        title: job.title,
        description: job.description
      }
    });

    if (!response.success) {
      return this.jobManager.updateJobStatus(job.id, "failed", {
        error: response.error ?? "Unknown A2A error"
      });
    }

    return this.jobManager.updateJobStatus(job.id, "completed", {
      output: JSON.stringify(response.result, null, 2)
    });
  }

  async getChatMode(): Promise<ChatMode> {
    return this.jobManager.getChatMode();
  }

  async setChatMode(mode: ChatMode): Promise<void> {
    await this.jobManager.setChatMode(mode);
  }

  async chat(message: string, userId: string): Promise<string> {
    const mode = await this.getChatMode();
    if (mode === "grok") {
      try {
        return await this.chatViaGrok(message, userId);
      } catch (error) {
        const fallback = await this.chatViaLocalLlmA2A(message);
        const reason = error instanceof Error ? error.message : "Unknown Grok API error";
        return `Grok-Mode ist gerade gestört (${reason}). Fallback auf Local-LLM:\n\n${fallback}`;
      }
    }
    return this.chatViaLocalLlmA2A(message);
  }

  private async chatViaLocalLlmA2A(message: string): Promise<string> {
    const response = await this.a2aClient.invokeCard("tesla-sentiment-llm", {
      action: "generate",
      payload: {
        prompt: `Antworte locker und humorvoll auf Deutsch in maximal 4 Saetzen: ${message}`,
        temperature: 0.5,
        max_tokens: 220
      }
    });

    if (!response.success) {
      throw new Error(response.error ?? "Local LLM A2A call failed");
    }

    const resultText = this.extractA2AText(response.result);
    return this.stripThinking(resultText);
  }

  private async chatViaGrok(message: string, userId: string): Promise<string> {
    const history = await this.jobManager.getChatHistory(userId);
    const compactHistory = history.map((entry) => ({
      role: entry.role,
      content: entry.content
    }));
    const reply = await this.grokClient.chatFreestyle(message, compactHistory);

    const now = new Date().toISOString();
    const newEntries: ChatHistoryEntry[] = [
      { role: "user", content: message, createdAt: now },
      { role: "assistant", content: reply, createdAt: now }
    ];
    await this.jobManager.appendChatHistory(userId, newEntries, 30);
    return reply;
  }

  private extractA2AText(result: unknown): string {
    if (typeof result === "string") {
      return result;
    }
    if (result && typeof result === "object") {
      const maybeObj = result as Record<string, unknown>;
      if (typeof maybeObj.text === "string") {
        return maybeObj.text;
      }
      if (
        maybeObj.result &&
        typeof maybeObj.result === "object" &&
        typeof (maybeObj.result as Record<string, unknown>).text === "string"
      ) {
        return (maybeObj.result as Record<string, string>).text;
      }
    }
    return JSON.stringify(result, null, 2);
  }

  private stripThinking(raw: string): string {
    const marker = "Thinking Process:";
    if (!raw.includes(marker)) {
      return raw.trim();
    }
    const lines = raw.split("\n").filter((line) => line.trim().length > 0);
    const lastLine = lines[lines.length - 1] ?? raw;
    return lastLine.trim();
  }
}

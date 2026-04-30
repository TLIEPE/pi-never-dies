import { A2ACard, Job } from "./types";

interface CursorAgentLike {
  prompt: (message: string, options?: { apiKey?: string }) => Promise<{ result?: string }>;
}

// Wraps the official Cursor SDK behind one stable project API.
export class CursorClient {
  private sdkAgent: CursorAgentLike | null = null;

  constructor(private readonly apiKey: string) {}

  async initialize(): Promise<void> {
    if (this.sdkAgent) {
      return;
    }

    const sdk = (await import("@cursor/sdk")) as { Agent?: CursorAgentLike };
    if (!sdk.Agent || typeof sdk.Agent.prompt !== "function") {
      const keys = Object.keys(sdk).join(", ");
      throw new Error(`Unsupported @cursor/sdk API shape. Export keys: [${keys}]`);
    }
    this.sdkAgent = sdk.Agent;
  }

  async createExecutionPlan(prompt: string, cards: A2ACard[], jobs: Job[]): Promise<string> {
    await this.initialize();
    if (!this.sdkAgent) {
      throw new Error("Cursor SDK client not initialized");
    }

    const mergedPrompt = [
      [
        "You are the orchestration brain of a Raspberry Pi assistant.",
        "You MUST only use A2A cards for delegated actions.",
        "Create concise actionable plans with numbered steps."
      ].join("\n"),
      [
      `User request: ${prompt}`,
      `Known A2A cards: ${JSON.stringify(cards)}`,
      `Current jobs: ${JSON.stringify(jobs.slice(0, 15))}`,
      "Return only a concise markdown plan and mention which card IDs should run."
      ].join("\n\n")
    ].join("\n\n");

    const response = await this.sdkAgent.prompt(mergedPrompt, { apiKey: this.apiKey });
    return (response.result ?? "Kein Plan vom Cursor SDK erhalten.").trim();
  }

  async chatFreestyle(message: string): Promise<string> {
    await this.initialize();
    if (!this.sdkAgent) {
      throw new Error("Cursor SDK client not initialized");
    }

    const mergedPrompt = [
      [
        "You are pi-never-dies, a witty but concise assistant living on a Raspberry Pi.",
        "Answer in German unless the user clearly requests another language.",
        "Keep responses practical, friendly, and short."
      ].join("\n"),
      `User message: ${message}`
    ].join("\n\n");

    const response = await this.sdkAgent.prompt(mergedPrompt, { apiKey: this.apiKey });
    return (response.result ?? "Keine Antwort vom Cursor SDK erhalten.").trim();
  }
}

import { A2ACard, Job } from "./types";

interface CursorAgentLike {
  prompt: (
    message: string,
    options?: { apiKey?: string; model?: { id: string } }
  ) => Promise<unknown>;
}

// Wraps the official Cursor SDK behind one stable project API.
export class CursorClient {
  private sdkAgent: CursorAgentLike | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly modelId: string
  ) {}

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

    const response = await this.sdkAgent.prompt(mergedPrompt, {
      apiKey: this.apiKey,
      model: { id: this.modelId }
    });
    return this.extractTextFromPromptResponse(response);
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

    const response = await this.sdkAgent.prompt(mergedPrompt, {
      apiKey: this.apiKey,
      model: { id: this.modelId }
    });
    return this.extractTextFromPromptResponse(response);
  }

  private extractTextFromPromptResponse(response: unknown): string {
    if (typeof response === "string" && response.trim()) {
      return response.trim();
    }

    if (response && typeof response === "object") {
      const obj = response as Record<string, unknown>;

      const directCandidates = ["result", "text", "output", "message"];
      for (const key of directCandidates) {
        const value = obj[key];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }

      if (obj.result && typeof obj.result === "object") {
        const nested = obj.result as Record<string, unknown>;
        for (const key of ["text", "output", "message", "result"]) {
          const value = nested[key];
          if (typeof value === "string" && value.trim()) {
            return value.trim();
          }
        }
      }
    }

    const summary =
      response && typeof response === "object"
        ? `keys=[${Object.keys(response as Record<string, unknown>).join(", ")}]`
        : `type=${typeof response}`;
    throw new Error(`Cursor SDK returned no usable text (${summary})`);
  }
}

import { A2ACard, Job } from "./types";

interface CursorCreateClientOptions {
  apiKey: string;
}

interface CursorChatInput {
  system: string;
  user: string;
}

interface CursorClientLike {
  chat: (input: CursorChatInput) => Promise<{ text: string }>;
}

// Wraps the official Cursor SDK behind one stable project API.
export class CursorClient {
  private sdkClient: CursorClientLike | null = null;

  constructor(private readonly apiKey: string) {}

  async initialize(): Promise<void> {
    if (this.sdkClient) {
      return;
    }

    const sdk = (await import("@cursor/sdk")) as {
      createClient?: (options: CursorCreateClientOptions) => CursorClientLike;
      CursorClient?: new (options: CursorCreateClientOptions) => CursorClientLike;
      default?: {
        createClient?: (options: CursorCreateClientOptions) => CursorClientLike;
        CursorClient?: new (options: CursorCreateClientOptions) => CursorClientLike;
      };
    };

    if (typeof sdk.createClient === "function") {
      this.sdkClient = sdk.createClient({ apiKey: this.apiKey });
      return;
    }

    if (sdk.CursorClient) {
      this.sdkClient = new sdk.CursorClient({ apiKey: this.apiKey });
      return;
    }

    if (sdk.default && typeof sdk.default.createClient === "function") {
      this.sdkClient = sdk.default.createClient({ apiKey: this.apiKey });
      return;
    }

    if (sdk.default?.CursorClient) {
      this.sdkClient = new sdk.default.CursorClient({ apiKey: this.apiKey });
      return;
    }

    const keys = Object.keys(sdk).join(", ");
    throw new Error(`Unsupported @cursor/sdk API shape. Export keys: [${keys}]`);
  }

  async createExecutionPlan(prompt: string, cards: A2ACard[], jobs: Job[]): Promise<string> {
    await this.initialize();
    if (!this.sdkClient) {
      throw new Error("Cursor SDK client not initialized");
    }

    const system = [
      "You are the orchestration brain of a Raspberry Pi assistant.",
      "You MUST only use A2A cards for delegated actions.",
      "Create concise actionable plans with numbered steps."
    ].join(" ");

    const user = [
      `User request: ${prompt}`,
      `Known A2A cards: ${JSON.stringify(cards)}`,
      `Current jobs: ${JSON.stringify(jobs.slice(0, 15))}`,
      "Return only a concise markdown plan and mention which card IDs should run."
    ].join("\n\n");

    const response = await this.sdkClient.chat({ system, user });
    return response.text.trim();
  }

  async chatFreestyle(message: string): Promise<string> {
    await this.initialize();
    if (!this.sdkClient) {
      throw new Error("Cursor SDK client not initialized");
    }

    const system = [
      "You are pi-never-dies, a witty but concise assistant living on a Raspberry Pi.",
      "Answer in German unless the user clearly requests another language.",
      "Keep responses practical, friendly, and short."
    ].join(" ");

    const response = await this.sdkClient.chat({
      system,
      user: message
    });
    return response.text.trim();
  }
}

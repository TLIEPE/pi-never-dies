import { promises as fs } from "node:fs";
import path from "node:path";
import { A2ACard, A2AInvokeRequest, A2AInvokeResponse } from "./types";

const DEFAULT_CARDS: A2ACard[] = [];

export class A2AClient {
  constructor(private readonly cardsFilePath: string) {}

  async ensureCardsFile(): Promise<void> {
    await fs.mkdir(path.dirname(this.cardsFilePath), { recursive: true });
    try {
      await fs.access(this.cardsFilePath);
    } catch {
      await fs.writeFile(this.cardsFilePath, `${JSON.stringify(DEFAULT_CARDS, null, 2)}\n`, "utf8");
    }
  }

  async listCards(): Promise<A2ACard[]> {
    await this.ensureCardsFile();
    const raw = await fs.readFile(this.cardsFilePath, "utf8");
    try {
      const parsed = JSON.parse(raw) as A2ACard[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async getCard(id: string): Promise<A2ACard | undefined> {
    const cards = await this.listCards();
    return cards.find((card) => card.id === id);
  }

  async invokeCard(cardId: string, request: A2AInvokeRequest): Promise<A2AInvokeResponse> {
    const card = await this.getCard(cardId);
    if (!card) {
      return { success: false, error: `Unknown A2A card: ${cardId}` };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (card.auth?.type === "bearer" && card.auth.tokenEnv) {
      const token = process.env[card.auth.tokenEnv];
      if (!token) {
        return {
          success: false,
          error: `Missing bearer token env variable for card '${card.id}': ${card.auth.tokenEnv}`
        };
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const requestBody =
      new URL(card.endpoint).pathname === "/a2a/task"
        ? {
            task_id: request.taskId ?? crypto.randomUUID(),
            action: request.action,
            input: request.payload
          }
        : request;

    try {
      const response = await fetch(card.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        return {
          success: false,
          error: `A2A call failed with HTTP ${response.status} ${response.statusText}`
        };
      }

      const result = (await response.json()) as unknown;
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown A2A invoke error"
      };
    }
  }
}

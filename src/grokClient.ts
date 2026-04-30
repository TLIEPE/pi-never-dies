interface GrokChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class GrokClient {
  constructor(
    private readonly apiKey: string,
    private readonly modelId: string,
    private readonly baseUrl: string
  ) {}

  async chatFreestyle(message: string): Promise<string> {
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const timeoutMs = 45_000;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: this.modelId,
            temperature: 0.5,
            messages: [
              {
                role: "system",
                content:
                  "You are pi-never-dies, a concise friendly assistant. Answer in German unless asked otherwise."
              },
              {
                role: "user",
                content: message
              }
            ]
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const body = await response.text();
          const error = new Error(
            `Grok API failed with HTTP ${response.status} ${response.statusText}: ${body.slice(
              0,
              280
            )}`
          );
          if (response.status === 429 || response.status >= 500) {
            lastError = error;
            if (attempt < maxAttempts) {
              await sleep(attempt * 1200);
              continue;
            }
          }
          throw error;
        }

        const data = (await response.json()) as GrokChatResponse;
        const content = data.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim()) {
          return content.trim();
        }
        if (Array.isArray(content)) {
          const text = content
            .map((part) => (typeof part.text === "string" ? part.text : ""))
            .join(" ")
            .trim();
          if (text) {
            return text;
          }
        }

        throw new Error("Grok API returned no text content.");
      } catch (error) {
        const isAbort = error instanceof Error && error.name === "AbortError";
        const wrapped = isAbort
          ? new Error("Grok API timeout after 45s.")
          : error instanceof Error
            ? error
            : new Error("Unknown Grok API error");

        lastError = wrapped;
        if (attempt < maxAttempts) {
          await sleep(attempt * 1200);
          continue;
        }
        throw wrapped;
      }
    }

    throw lastError ?? new Error("Grok API request failed.");
  }
}

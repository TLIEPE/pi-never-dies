interface GrokChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

export class GrokClient {
  constructor(
    private readonly apiKey: string,
    private readonly modelId: string,
    private readonly baseUrl: string
  ) {}

  async chatFreestyle(message: string): Promise<string> {
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
      })
    });

    if (!response.ok) {
      throw new Error(`Grok API failed with HTTP ${response.status} ${response.statusText}`);
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
  }
}

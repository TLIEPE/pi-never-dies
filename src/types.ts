export type JobStatus = "pending" | "running" | "completed" | "failed";
export type ChatMode = "grok" | "local";
export type ChatRole = "user" | "assistant";

export interface ChatHistoryEntry {
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  targetAgentCardId?: string;
  output?: string;
  error?: string;
}

export interface JobsFile {
  jobs: Job[];
  lastHeartbeatAt: string | null;
  chatMode: ChatMode;
}

export interface ChatMemoryFile {
  users: Record<string, ChatHistoryEntry[]>;
}

export interface A2ACard {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  capabilities: string[];
  auth?: {
    type: "none" | "bearer";
    tokenEnv?: string;
  };
}

export interface A2AInvokeRequest {
  action: string;
  payload: Record<string, unknown>;
  taskId?: string;
}

export interface A2AInvokeResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface AppConfig {
  telegramBotToken: string;
  telegramAllowedUserIds: number[];
  cursorApiKey: string;
  cursorModelId: string;
  grokApiKey: string;
  grokModelId: string;
  grokBaseUrl: string;
  jobsFilePath: string;
  chatMemoryFilePath: string;
  heartbeatIntervalMs: number;
  a2aCardsFilePath: string;
}

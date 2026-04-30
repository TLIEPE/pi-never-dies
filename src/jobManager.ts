import { promises as fs } from "node:fs";
import path from "node:path";
import { ChatHistoryEntry, ChatMode, Job, JobsFile, JobStatus } from "./types";

const EMPTY_JOBS_FILE: JobsFile = {
  jobs: [],
  lastHeartbeatAt: null,
  chatMode: "local",
  chatMemory: {}
};

export class JobManager {
  constructor(private readonly jobsFilePath: string) {}

  async ensureStore(): Promise<void> {
    await fs.mkdir(path.dirname(this.jobsFilePath), { recursive: true });
    try {
      await fs.access(this.jobsFilePath);
    } catch {
      await this.writeData(EMPTY_JOBS_FILE);
    }
  }

  async listJobs(): Promise<Job[]> {
    const data = await this.readData();
    return [...data.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createJob(input: {
    title: string;
    description: string;
    targetAgentCardId?: string;
  }): Promise<Job> {
    const data = await this.readData();
    const now = new Date().toISOString();
    const job: Job = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      description: input.description.trim(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
      targetAgentCardId: input.targetAgentCardId
    };
    data.jobs.push(job);
    await this.writeData(data);
    return job;
  }

  async updateJobStatus(
    id: string,
    status: JobStatus,
    options?: { output?: string; error?: string }
  ): Promise<Job> {
    const data = await this.readData();
    const job = data.jobs.find((entry) => entry.id === id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    job.status = status;
    job.updatedAt = new Date().toISOString();
    if (options?.output !== undefined) {
      job.output = options.output;
    }
    if (options?.error !== undefined) {
      job.error = options.error;
    }

    await this.writeData(data);
    return job;
  }

  async setHeartbeatNow(): Promise<void> {
    const data = await this.readData();
    data.lastHeartbeatAt = new Date().toISOString();
    await this.writeData(data);
  }

  async getHeartbeat(): Promise<string | null> {
    const data = await this.readData();
    return data.lastHeartbeatAt;
  }

  async getRunningJobsCount(): Promise<number> {
    const data = await this.readData();
    return data.jobs.filter((job) => job.status === "running").length;
  }

  async getChatMode(): Promise<ChatMode> {
    const data = await this.readData();
    return data.chatMode === "grok" || data.chatMode === "local" ? data.chatMode : "local";
  }

  async setChatMode(mode: ChatMode): Promise<void> {
    const data = await this.readData();
    data.chatMode = mode;
    await this.writeData(data);
  }

  async getChatHistory(userId: string): Promise<ChatHistoryEntry[]> {
    const data = await this.readData();
    return data.chatMemory[userId] ?? [];
  }

  async appendChatHistory(
    userId: string,
    entries: ChatHistoryEntry[],
    maxEntries: number
  ): Promise<void> {
    const data = await this.readData();
    const current = data.chatMemory[userId] ?? [];
    const merged = [...current, ...entries];
    data.chatMemory[userId] = merged.slice(Math.max(0, merged.length - maxEntries));
    await this.writeData(data);
  }

  private async readData(): Promise<JobsFile> {
    await this.ensureStore();
    const raw = await fs.readFile(this.jobsFilePath, "utf8");
    try {
      const parsed = JSON.parse(raw) as JobsFile;
      if (!Array.isArray(parsed.jobs)) {
        return { ...EMPTY_JOBS_FILE };
      }
      return {
        jobs: parsed.jobs,
        lastHeartbeatAt: parsed.lastHeartbeatAt ?? null,
        chatMode:
          parsed.chatMode === "grok" || parsed.chatMode === "local"
            ? parsed.chatMode
            : "local",
        chatMemory: parsed.chatMemory && typeof parsed.chatMemory === "object" ? parsed.chatMemory : {}
      };
    } catch {
      return { ...EMPTY_JOBS_FILE };
    }
  }

  private async writeData(content: JobsFile): Promise<void> {
    const payload = `${JSON.stringify(content, null, 2)}\n`;
    await fs.writeFile(this.jobsFilePath, payload, "utf8");
  }
}

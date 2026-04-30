import { promises as fs } from "node:fs";
import path from "node:path";
import { Job, JobsFile, JobStatus } from "./types";

const EMPTY_JOBS_FILE: JobsFile = { jobs: [], lastHeartbeatAt: null };

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
        lastHeartbeatAt: parsed.lastHeartbeatAt ?? null
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

import { A2AClient } from "./a2aClient";
import { CursorClient } from "./cursorClient";
import { JobManager } from "./jobManager";
import { Job } from "./types";

export class Actions {
  constructor(
    private readonly jobManager: JobManager,
    private readonly a2aClient: A2AClient,
    private readonly cursorClient: CursorClient
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
}

const stamp = (): string => new Date().toISOString();

export const logger = {
  info(message: string, meta?: unknown): void {
    if (meta === undefined) {
      console.log(`[${stamp()}] INFO  ${message}`);
      return;
    }
    console.log(`[${stamp()}] INFO  ${message}`, meta);
  },

  warn(message: string, meta?: unknown): void {
    if (meta === undefined) {
      console.warn(`[${stamp()}] WARN  ${message}`);
      return;
    }
    console.warn(`[${stamp()}] WARN  ${message}`, meta);
  },

  error(message: string, error?: unknown): void {
    if (error === undefined) {
      console.error(`[${stamp()}] ERROR ${message}`);
      return;
    }
    console.error(`[${stamp()}] ERROR ${message}`, error);
  }
};

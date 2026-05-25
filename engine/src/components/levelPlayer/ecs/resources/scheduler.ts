export type ScheduledTask = {
  remove: () => void;
};

type ScheduledEntry = {
  dueMs: number;
  callback: () => void;
  cancelled: boolean;
};

export class Scheduler {
  private nowMs = 0;
  private tasks: ScheduledEntry[] = [];

  schedule(delayMs: number, callback: () => void): ScheduledTask {
    const task: ScheduledEntry = {
      dueMs: this.nowMs + delayMs,
      callback,
      cancelled: false,
    };

    this.tasks.push(task);

    return {
      remove: () => {
        task.cancelled = true;
      },
    };
  }

  update(deltaMs: number): void {
    this.nowMs += deltaMs;

    for (let index = this.tasks.length - 1; index >= 0; index--) {
      const task = this.tasks[index];
      if (!task) continue;
      if (task.cancelled) {
        this.tasks.splice(index, 1);
        continue;
      }

      if (task.dueMs <= this.nowMs) {
        this.tasks.splice(index, 1);
        task.callback();
      }
    }
  }
}

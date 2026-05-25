import type { PlayerInputState } from "./systems/input/playerControlInputSystem.js";

export type InputLogEntry = {
  frame: number;
  input: PlayerInputState;
};

export class InputRecorder {
  private entries: InputLogEntry[] = [];
  private currentFrame = 0;

  reset(): void {
    this.entries = [];
    this.currentFrame = 0;
  }

  record(input: PlayerInputState): void {
    this.entries.push({ frame: this.currentFrame, input });
    this.currentFrame++;
  }

  getLog(): InputLogEntry[] {
    return this.entries;
  }

  get frame(): number {
    return this.currentFrame;
  }
}

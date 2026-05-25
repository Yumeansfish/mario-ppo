"""Save deterministic-pass checkpoints during PPO training."""

from __future__ import annotations

import csv
from dataclasses import replace
from pathlib import Path

from stable_baselines3.common.callbacks import BaseCallback

from config.config import DEFAULT_REWARD_CONFIG
from env.headless_env import MarioHeadlessEnv


class DeterministicEvalCallback(BaseCallback):
    def __init__(
        self,
        save_path: Path,
        log_path: Path,
        eval_freq_timesteps: int = 25_000,
        max_steps: int = 1000,
    ) -> None:
        super().__init__()
        self.save_path = save_path
        self.log_path = log_path
        self.eval_freq_timesteps = eval_freq_timesteps
        self.max_steps = max_steps
        self._next_eval = eval_freq_timesteps
        self._eval_env: MarioHeadlessEnv | None = None
        self._wrote_header = False

    def _init_callback(self) -> None:
        self.save_path.parent.mkdir(parents=True, exist_ok=True)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        reward_config = replace(
            DEFAULT_REWARD_CONFIG,
            max_steps=self.max_steps,
            stuck_window=self.max_steps,
        )
        self._eval_env = MarioHeadlessEnv(reward_config=reward_config)

    def _on_step(self) -> bool:
        if self.num_timesteps < self._next_eval:
            return True

        result = self._run_deterministic_episode()
        saved = bool(result["complete"])
        if saved:
            self.model.save(str(self.save_path))

        self._write_result(result, saved)
        self.logger.record("det_eval/max_x", float(result["max_x"]))
        self.logger.record("det_eval/complete", int(result["complete"]))
        self.logger.record("det_eval/saved", int(saved))
        print(
            f"[det-eval {self.num_timesteps:>9d}] "
            f"max_x={result['max_x']:7.1f} complete={result['complete']} "
            f"dead={result['dead']} steps={result['steps']} "
            f"{'saved' if saved else ''}"
        )

        while self._next_eval <= self.num_timesteps:
            self._next_eval += self.eval_freq_timesteps
        return True

    def _on_training_end(self) -> None:
        if self._eval_env is not None:
            self._eval_env.close()
            self._eval_env = None

    def _run_deterministic_episode(self) -> dict[str, int | float | bool]:
        assert self._eval_env is not None
        obs, _ = self._eval_env.reset()
        last_info = {}
        steps = 0

        while True:
            action, _ = self.model.predict(obs, deterministic=True)
            obs, _, terminated, truncated, info = self._eval_env.step(action)
            steps += 1
            last_info = info
            if terminated or truncated:
                break

        max_x = float(last_info.get("max_x", 0.0))
        complete = bool(last_info.get("is_complete"))
        dead = bool(last_info.get("game_over"))
        return {
            "timesteps": int(self.num_timesteps),
            "steps": int(steps),
            "max_x": max_x,
            "complete": complete,
            "dead": dead,
        }

    def _write_result(
        self,
        result: dict[str, int | float | bool],
        saved: bool,
    ) -> None:
        row = {
            **result,
            "saved": int(saved),
        }
        with self.log_path.open("a", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=row.keys())
            if not self._wrote_header:
                writer.writeheader()
                self._wrote_header = True
            writer.writerow(row)

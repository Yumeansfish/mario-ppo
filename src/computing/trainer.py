from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import numpy as np
import torch
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback, CheckpointCallback
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv, VecMonitor

SRC_ROOT = Path(__file__).resolve().parents[1]
WORK_ROOT = SRC_ROOT.parent
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from env.headless_env import MarioHeadlessEnv
from env.feature_extractor import MarioGridExtractor
from config.config import TRAINING_SEED
from computing.deterministic_eval_callback import DeterministicEvalCallback

ROOT = WORK_ROOT
LOG_DIR = ROOT / "logs"
CKPT_DIR = ROOT / "checkpoints"


def make_env(rank: int):
    def _init():
        env = MarioHeadlessEnv()
        env = Monitor(env)
        return env
    return _init


class ProgressCallback(BaseCallback):
    def __init__(self, log_every: int = 5_000):
        super().__init__()
        self.log_every = log_every
        self._next = log_every
        self._max_x_seen = 0.0
        self._completes = 0
        self._deaths = 0
        self._t0 = time.time()

    def _on_step(self) -> bool:
        infos = self.locals.get("infos", [])
        for info in infos:
            if "px" in info:
                self._max_x_seen = max(self._max_x_seen, info.get("max_x", 0.0))
            if info.get("is_complete"):
                self._completes += 1
            if info.get("game_over"):
                self._deaths += 1

        if self.num_timesteps >= self._next:
            dt = time.time() - self._t0
            fps = self.num_timesteps / dt
            self.logger.record("mario/max_x_seen", float(self._max_x_seen))
            self.logger.record("mario/episodes_completed", int(self._completes))
            self.logger.record("mario/episodes_dead", int(self._deaths))
            self.logger.record("mario/wall_fps", float(fps))
            print(
                f"[{self.num_timesteps:>9d} steps] max_x={self._max_x_seen:7.1f} "
                f"completes={self._completes} deaths={self._deaths} fps={fps:.0f}"
            )
            self._next += self.log_every
        return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n-envs", type=int, default=8)
    ap.add_argument("--total-timesteps", type=int, default=200_000)
    ap.add_argument("--n-steps", type=int, default=512)
    ap.add_argument("--batch-size", type=int, default=512)
    ap.add_argument("--learning-rate", type=float, default=3e-4)
    ap.add_argument("--gamma", type=float, default=0.99)
    ap.add_argument("--gae-lambda", type=float, default=0.95)
    ap.add_argument("--ent-coef", type=float, default=0.01)
    ap.add_argument("--clip-range", type=float, default=0.2)
    ap.add_argument("--n-epochs", type=int, default=4)
    ap.add_argument("--device", default="auto")
    ap.add_argument("--seed", type=int, default=TRAINING_SEED)
    ap.add_argument("--use-subproc", action="store_true", default=True)
    ap.add_argument("--use-dummy", dest="use_subproc", action="store_false")
    ap.add_argument("--run-name", default=None)
    ap.add_argument("--det-eval-freq", type=int, default=25_000)
    ap.add_argument("--det-eval-max-steps", type=int, default=1000)
    args = ap.parse_args()

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    CKPT_DIR.mkdir(parents=True, exist_ok=True)
    run_name = args.run_name or f"ppo_{int(time.time())}"

    if args.use_subproc and args.n_envs > 1:
        env = SubprocVecEnv([make_env(i) for i in range(args.n_envs)], start_method="spawn")
    else:
        env = DummyVecEnv([make_env(i) for i in range(args.n_envs)])
    env = VecMonitor(env, filename=str(LOG_DIR / f"{run_name}.monitor.csv"))

    device = args.device
    if device == "auto":
        if torch.cuda.is_available():
            device = "cuda"
        elif torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"
    print(f"device: {device}; n_envs: {args.n_envs}; total: {args.total_timesteps}")

    model = PPO(
        "MultiInputPolicy",
        env,
        n_steps=args.n_steps,
        batch_size=args.batch_size,
        n_epochs=args.n_epochs,
        learning_rate=args.learning_rate,
        gamma=args.gamma,
        gae_lambda=args.gae_lambda,
        ent_coef=args.ent_coef,
        clip_range=args.clip_range,
        verbose=1,
        device=device,
        seed=args.seed,
        tensorboard_log=None if os.environ.get("DISABLE_TENSORBOARD") == "1" else str(LOG_DIR),
        policy_kwargs=dict(
            features_extractor_class=MarioGridExtractor,
            features_extractor_kwargs=dict(grid_features=128),
            net_arch=dict(pi=[128, 128], vf=[128, 128]),
        ),
    )

    cb_ckpt = CheckpointCallback(
        save_freq=max(1, 50_000 // args.n_envs),
        save_path=str(CKPT_DIR / run_name),
        name_prefix="ppo",
    )
    cb_prog = ProgressCallback(log_every=max(2000, args.total_timesteps // 50))
    cb_det = DeterministicEvalCallback(
        save_path=CKPT_DIR / run_name / "ppo_deterministic_pass.zip",
        log_path=LOG_DIR / f"{run_name}.deterministic_eval.csv",
        eval_freq_timesteps=args.det_eval_freq,
        max_steps=args.det_eval_max_steps,
    )

    model.learn(
        total_timesteps=args.total_timesteps,
        callback=[cb_ckpt, cb_prog, cb_det],
        tb_log_name=run_name,
    )

    final = CKPT_DIR / run_name / "ppo_final.zip"
    model.save(str(final))
    print(f"saved: {final}")
    env.close()


if __name__ == "__main__":
    main()
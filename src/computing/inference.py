from __future__ import annotations

import argparse
import csv
import sys
import time
from dataclasses import replace
from pathlib import Path

import numpy as np
from stable_baselines3 import PPO

SRC_ROOT = Path(__file__).resolve().parents[1]
WORK_ROOT = SRC_ROOT.parent
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

import env.feature_extractor as feature_extractor_module
from config.config import DEFAULT_REWARD_CONFIG
from env.headless_env import MarioHeadlessEnv
from env.feature_extractor import MarioGridExtractor

ROOT = WORK_ROOT
sys.modules.setdefault("feature_extractor", feature_extractor_module)


def run_eval(model, episodes: int, deterministic: bool, max_steps: int):
    reward_config = replace(
        DEFAULT_REWARD_CONFIG,
        max_steps=max_steps,
        stuck_window=max_steps,
    )
    env = MarioHeadlessEnv(reward_config=reward_config)
    rows = []
    completions = 0
    max_xs = []
    rewards = []
    for ep in range(episodes):
        obs, _ = env.reset()
        ep_ret = 0.0
        last_info = {}
        steps = 0
        while True:
            action, _ = model.predict(obs, deterministic=deterministic)
            obs, r, term, trunc, info = env.step(action)
            ep_ret += r
            steps += 1
            last_info = info
            if term or trunc:
                break
        max_x = last_info.get("max_x", 0.0)
        complete = bool(last_info.get("is_complete"))
        dead = bool(last_info.get("game_over"))
        max_xs.append(max_x)
        rewards.append(ep_ret)
        completions += int(complete)
        print(
            f"  ep {ep:2d} | steps={steps:5d} | return={ep_ret:+8.3f} | "
            f"max_x={max_x:7.1f} ({100*max_x/env._map_w:5.1f}%) | "
            f"complete={complete} dead={dead}"
        )
        rows.append({
            "ep": ep, "deterministic": int(deterministic),
            "steps": steps, "return": ep_ret,
            "max_x": max_x, "progress_frac": max_x / env._map_w,
            "complete": int(complete), "dead": int(dead),
        })
    map_w = env._map_w
    env.close()
    return rows, completions, max_xs, rewards, map_w


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="path to ppo .zip")
    ap.add_argument("--episodes", type=int, default=20)
    ap.add_argument("--deterministic", action="store_true", default=False)
    ap.add_argument("--both", action="store_true", default=False, help="eval both stochastic and deterministic")
    ap.add_argument("--max-steps", type=int, default=3000)
    ap.add_argument("--csv", default=None)
    args = ap.parse_args()

    model = PPO.load(args.model, device="cpu")

    modes = [("stochastic", False), ("deterministic", True)] if args.both else (
        [("deterministic" if args.deterministic else "stochastic", args.deterministic)]
    )

    all_rows = []
    summary = []
    for label, det in modes:
        print(f"\n=== mode: {label} ({args.episodes} episodes) ===")
        rows, comps, max_xs, rewards, map_w = run_eval(model, args.episodes, det, args.max_steps)
        all_rows.extend(rows)
        completion_rate = 100 * comps / args.episodes
        mean_x = float(np.mean(max_xs))
        mean_ret = float(np.mean(rewards))
        summary.append((label, comps, args.episodes, completion_rate, mean_x, map_w, mean_ret))
        print(f"  completion : {comps}/{args.episodes} = {completion_rate:.1f}%")
        print(f"  mean max_x : {mean_x:.1f}  ({100*mean_x/map_w:.1f}%)")
        print(f"  mean return: {mean_ret:+.3f}")

    print("\n=== summary ===")
    for label, c, e, cr, mx, mw, mr in summary:
        print(f"  {label:13s}: {c}/{e} = {cr:5.1f}%  | mean max_x = {mx:.0f} ({100*mx/mw:.1f}%) | return = {mr:+.2f}")

    csv_path = args.csv
    if csv_path is None:
        run = Path(args.model).stem
        csv_path = str(ROOT / "logs" / f"eval_{run}.csv")
    Path(csv_path).parent.mkdir(parents=True, exist_ok=True)
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=all_rows[0].keys())
        w.writeheader()
        w.writerows(all_rows)
    print(f"\nwrote {csv_path}")


if __name__ == "__main__":
    main()

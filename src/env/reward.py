"""Reward shaping and episode termination for the Mario PPO environment."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from config.config import RewardConfig


@dataclass
class RewardState:
    max_x: float = 0.0
    prev_x: float = 0.0
    frames_since_progress: int = 0
    prev_on_ground: bool = False
    takeoff_x: float = 0.0
    checkpoints_hit: int = 0


@dataclass
class RewardStepResult:
    reward: float
    terminated: bool
    truncated: bool
    info: dict[str, Any]
    release_jump_next_step: bool


def make_initial_reward_state(obs_raw: dict[str, Any]) -> RewardState:
    player = obs_raw["player"]
    return RewardState(
        max_x=player["x"],
        prev_x=player["x"],
        prev_on_ground=bool(player.get("onGround", False)),
        takeoff_x=player["x"],
    )


def compute_reward_step(
    raw: dict[str, Any],
    state: RewardState,
    config: RewardConfig,
    step_count: int,
    map_w: float,
) -> RewardStepResult:
    px = raw["player"]["x"]
    on_ground = bool(raw["player"]["onGround"])

    reward = -config.time_penalty
    if px > state.prev_x:
        reward += config.forward_displacement_bonus

    release_jump_next_step = False
    if not on_ground and state.prev_on_ground:
        state.takeoff_x = px
    elif on_ground and not state.prev_on_ground:
        jump_dx = px - state.takeoff_x
        if jump_dx > 50.0:
            reward += config.jump_completion_bonus * min(jump_dx / 128.0, 2.0)
        release_jump_next_step = True
    state.prev_on_ground = on_ground

    progress = max(0.0, px - state.max_x)
    if progress > 0:
        reward += config.progress_reward_scale * (progress / map_w)
        state.max_x = px
        state.frames_since_progress = 0
    else:
        state.frames_since_progress += 1
    state.prev_x = px

    for i, checkpoint_x in enumerate(config.progress_checkpoints):
        bit = 1 << i
        if not (state.checkpoints_hit & bit) and px >= checkpoint_x:
            reward += config.checkpoint_bonus
            state.checkpoints_hit |= bit

    terminated = False
    truncated = False

    if raw.get("isComplete"):
        reward += config.finish_bonus
        terminated = True
    elif raw.get("gameOver") or not raw["player"].get("alive", True):
        reward -= config.death_penalty
        terminated = True

    if not terminated:
        if step_count >= config.max_steps:
            truncated = True
        elif state.frames_since_progress >= config.stuck_window:
            truncated = True
            reward -= 1.0

    info = {
        "px": px,
        "py": raw["player"]["y"],
        "vx": raw["player"]["vx"],
        "vy": raw["player"]["vy"],
        "on_ground": raw["player"]["onGround"],
        "max_x": state.max_x,
        "progress_frac": state.max_x / map_w,
        "is_complete": bool(raw.get("isComplete")),
        "game_over": bool(raw.get("gameOver")),
        "frame": raw["frame"],
    }

    return RewardStepResult(
        reward=float(reward),
        terminated=terminated,
        truncated=truncated,
        info=info,
        release_jump_next_step=release_jump_next_step,
    )

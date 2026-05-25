"""Gymnasium env that wraps the headless Node runner over stdin/stdout NDJSON."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import gymnasium as gym

from config.config import (
    DEFAULT_REWARD_CONFIG,
    RewardConfig,
)
from .action import (
    ActionState,
    action_to_input,
    make_action_space,
)
from .observation import (
    StaticObservationData,
    make_observation,
    make_observation_space,
    read_static_observation,
)
from .reward import (
    RewardState,
    compute_reward_step,
    make_initial_reward_state,
)
from .runner_client import HeadlessRunnerClient

WORK_ROOT = Path(__file__).resolve().parents[2]
RUNNER_DIR = WORK_ROOT / "engine"


class MarioHeadlessEnv(gym.Env):

    def __init__(
        self,
        reward_config: RewardConfig = DEFAULT_REWARD_CONFIG,
        runner_cwd: Path = RUNNER_DIR,
        runner_cmd: tuple[str, ...] = ("npx", "tsx", "runner.ts"),
    ) -> None:
        super().__init__()
        self.runner = HeadlessRunnerClient(runner_cwd, runner_cmd)
        self.reward_config = reward_config

        self.observation_space = make_observation_space()
        self.action_space = make_action_space()

        self._static_obs: StaticObservationData | None = None
        self._action_state = ActionState()
        self._reward_state = RewardState()

        self._map_w = 0.0

        self._steps = 0

    def close(self) -> None:
        self.runner.close()

    # ----- gym API -----

    def reset(self, *, seed: int | None = None, options: dict | None = None):
        super().reset(seed=seed)
        obs_raw = self.runner.reset()
        self._ingest_static(obs_raw)
        self._steps = 0
        self._action_state = ActionState()
        self._reward_state = make_initial_reward_state(obs_raw)
        return self._to_obs(obs_raw), {}

    def step(self, action):
        input_dict = action_to_input(action, self._action_state)
        raw = self.runner.step(input_dict)
        self._steps += 1

        reward_result = compute_reward_step(
            raw,
            self._reward_state,
            self.reward_config,
            self._steps,
            self._map_w,
        )
        if reward_result.release_jump_next_step:
            self._action_state.release_jump_this_step = True

        return (
            self._to_obs(raw),
            reward_result.reward,
            reward_result.terminated,
            reward_result.truncated,
            reward_result.info,
        )

    # ----- helpers -----

    def _ingest_static(self, msg: dict[str, Any]) -> None:
        self._static_obs = read_static_observation(msg)
        self._map_w = self._static_obs.map_w

    def _to_obs(self, msg: dict[str, Any]):
        assert self._static_obs is not None
        return make_observation(msg, self._static_obs, self._reward_state.max_x)

"""Configuration values for the Mario PPO environment."""

from __future__ import annotations

from dataclasses import dataclass

TRAINING_SEED = 0

INPUT_BITS = ("left", "right", "jump", "run")

# 3*10*16 = 480 -> CNN -> 128
# grid obs shape is (3, 10, 16):
# channel 0: solid map tiles
# channel 1: enemies
# channel 2: shells
W_VIEW = 16
H_VIEW = 10
N_CHANNELS = 3

# vec obs shape is (14,):
# 0: normalized player x = pl.x / map.width
# 1: normalized player y = pl.y / map.height
# 2: normalized player x velocity = vx/30
# 3: normalized player y velocity = vy/30
# 4: player is on ground = 0/1
# 5: normalized horizontal distance to door = xdoor - xpl / map.width
# 6: unused, always 0.0 in v27
# 7: player is alive = 0/1
# 8-11: ground sensors at player tile x + 0..3
# 12-13: wall sensors at player tile x + 1..2
VEC_DIM = 14




@dataclass(frozen=True)
class RewardConfig:
    max_steps: int = 2400
    stuck_window: int = 600
    progress_reward_scale: float = 30.0
    forward_displacement_bonus: float = 0.0005
    jump_completion_bonus: float = 0.5
    checkpoint_bonus: float = 5.0
    time_penalty: float = 0.001
    death_penalty: float = 0.1
    finish_bonus: float = 100.0
    # the first 1700 has human prior,then increase 1000
    progress_checkpoints: tuple[float, ...] = (
        1700.0,
        2700.0,
        3700.0,
        4700.0,
        5700.0,
        6700.0,
    )


DEFAULT_REWARD_CONFIG = RewardConfig()

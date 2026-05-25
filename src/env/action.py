from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from gymnasium import spaces

from config.config import INPUT_BITS


@dataclass
class ActionState:
    # release the jump after jump to make sure that
    # the agent can do consistent jump
    release_jump_this_step: bool = False


def make_action_space() -> spaces.MultiBinary:
    return spaces.MultiBinary(len(INPUT_BITS))


def action_to_input(
    action: Any,
    state: ActionState,
) -> dict[str, bool]:
    arr = np.asarray(action).reshape(-1)
    input_dict = {name: bool(arr[i]) for i, name in enumerate(INPUT_BITS)}

    if state.release_jump_this_step:
        input_dict["jump"] = False
        state.release_jump_this_step = False

    return input_dict

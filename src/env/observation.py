"""Observation construction for the Mario PPO environment."""

from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any

import numpy as np
from gymnasium import spaces

from config.config import H_VIEW, N_CHANNELS, VEC_DIM, W_VIEW

SOLID_CHANNEL = 0
ENEMY_CHANNEL = 1
SHELL_CHANNEL = 2
SHELL_KIND = 4


# data from runner reset in raw msg
@dataclass
class StaticObservationData:
    grid_layout: np.ndarray
    grid_w: int
    grid_h: int
    tile_size: int
    map_w: float
    map_h: float
    door_x: float
    door_y: float


# schema for make_observation
def make_observation_space() -> spaces.Dict:
    return spaces.Dict({
        "grid": spaces.Box(
            low=0,
            high=1,
            shape=(N_CHANNELS, H_VIEW, W_VIEW),
            dtype=np.float32,
        ),
        "vec": spaces.Box(low=-2.0, high=2.0, shape=(VEC_DIM,), dtype=np.float32),
    })


# parse static json -> staticObservationData
def read_static_observation(msg: dict[str, Any]) -> StaticObservationData:
    tile = msg["tile"]
    grid_w = tile["w"]
    grid_h = tile["h"]
    tile_size = tile["size"]
    raw = base64.b64decode(tile["grid"])
    static_grid = np.frombuffer(raw, dtype=np.uint8).reshape(grid_h, grid_w)

    return StaticObservationData(
        grid_layout=static_grid,
        grid_w=grid_w,
        grid_h=grid_h,
        tile_size=tile_size,
        map_w=msg["mapSize"]["width"],
        map_h=msg["mapSize"]["height"],
        door_x=msg["door"]["x"],
        door_y=msg["door"]["y"],
    )

def make_observation(
    msg: dict[str, Any],
    static: StaticObservationData,
    _max_x: float,
    # max_x = best progress
    # this is always zero because in this ablation 
    # it has been masked
                
) -> dict[str, np.ndarray]:
    # player_x : real position in map
    # player_tile_x : which tile player is on
    player_x = msg["player"]["x"]
    player_y = msg["player"]["y"]
    player_tile_x = int(player_x // static.tile_size)
    player_tile_y = int(player_y // static.tile_size)

    view_origin_x, view_origin_y = _observation_window_origin(
        player_tile_x,
        player_tile_y,
    )
    grid = _make_grid_observation(msg, static, view_origin_x, view_origin_y)
    vec = _make_vector_observation(
        msg,
        static,
        player_x,
        player_y,
        player_tile_x,
        player_tile_y,
    )

    return {"grid": grid, "vec": vec}


# player_tile_pos -> viewport_start_pos in x,y
def _observation_window_origin(
    player_tile_x: int,
    player_tile_y: int,
) -> tuple[int, int]:
    return player_tile_x - W_VIEW // 2, player_tile_y - H_VIEW // 2 + 1


# helper for grid_obs
def _make_grid_observation(
    msg: dict[str, Any],
    static: StaticObservationData,
    view_origin_x: int,
    view_origin_y: int,
) -> np.ndarray:
    grid = np.zeros((N_CHANNELS, H_VIEW, W_VIEW), dtype=np.float32)
    _write_solid_tiles(grid, static, view_origin_x, view_origin_y)
    _write_dynamic_entities(grid, msg, static, view_origin_x, view_origin_y)
    return grid


# use staticData to fill solid tile channel in viewport
def _write_solid_tiles(
    grid: np.ndarray,
    static: StaticObservationData,
    view_origin_x: int,
    view_origin_y: int,
) -> None:
    for dy in range(H_VIEW):
        wy = view_origin_y + dy
        if wy < 0 or wy >= static.grid_h:
            continue
        for dx in range(W_VIEW):
            wx = view_origin_x + dx
            if wx < 0 or wx >= static.grid_w:
                continue
            v = static.grid_layout[wy, wx]
            if v == 1:
                grid[SOLID_CHANNEL, dy, dx] = 1.0

# convert pos of enemy and fill enemy/shell channel in viewport
def _write_dynamic_entities(
    grid: np.ndarray,
    msg: dict[str, Any],
    static: StaticObservationData,
    view_origin_x: int,
    view_origin_y: int,
) -> None:
    for enemy in msg["enemies"]:
        ex = int(enemy["x"] // static.tile_size) - view_origin_x
        ey = int(enemy["y"] // static.tile_size) - view_origin_y
        if 0 <= ex < W_VIEW and 0 <= ey < H_VIEW:
            if enemy["k"] == SHELL_KIND:
                grid[SHELL_CHANNEL, ey, ex] = 1.0
            else:
                grid[ENEMY_CHANNEL, ey, ex] = 1.0


# normalize vec_obs -> vector in float32
def _make_vector_observation(
    msg: dict[str, Any],
    static: StaticObservationData,
    player_x: float,
    player_y: float,
    player_tile_x: int,
    player_tile_y: int,
) -> np.ndarray:
    sensors = _read_tile_sensors(static, player_tile_x, player_tile_y)
    return np.array([
        np.clip(player_x / static.map_w, 0.0, 1.5),
        np.clip(player_y / static.map_h, 0.0, 1.5),
        np.clip(msg["player"]["vx"] / 30.0, -1.5, 1.5),
        np.clip(msg["player"]["vy"] / 30.0, -1.5, 1.5),
        1.0 if msg["player"]["onGround"] else 0.0,
        np.clip((static.door_x - player_x) / static.map_w, -1.5, 1.5),
        0.0,
        1.0 if msg["player"].get("alive", True) else 0.0,
        *sensors,
    ], dtype=np.float32)


def _read_tile_sensors(
    static: StaticObservationData,
    player_tile_x: int,
    player_tile_y: int,
) -> list[float]:
    sensors: list[float] = []

    # Ground sensors: directly below and ahead of the player.
    for dx in (0, 1, 2, 3):
        wx = player_tile_x + dx
        wy = player_tile_y + 1
        sensors.append(_ground_sensor_value(static, wx, wy))

    # Wall sensors: one and two tiles ahead at player body height.
    for dx in (1, 2):
        wx = player_tile_x + dx
        wy = player_tile_y
        sensors.append(_wall_sensor_value(static, wx, wy))

    return sensors


def _tile_value(static: StaticObservationData, wx: int, wy: int) -> int:
    if 0 <= wx < static.grid_w and 0 <= wy < static.grid_h:
        return int(static.grid_layout[wy, wx])
    return 0


def _ground_sensor_value(static: StaticObservationData, wx: int, wy: int) -> float:
    return 1.0 if _tile_value(static, wx, wy) == 1 else 0.0


def _wall_sensor_value(static: StaticObservationData, wx: int, wy: int) -> float:
    return 1.0 if _tile_value(static, wx, wy) == 1 else 0.0

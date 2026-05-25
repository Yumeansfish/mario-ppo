"""
custom extractor for grid_obs
grid -> CNN -> 128D
128 + 14 = 142D in final
"""

from __future__ import annotations

import gymnasium as gym
import torch as th
from torch import nn
from stable_baselines3.common.torch_layers import BaseFeaturesExtractor


class MarioGridExtractor(BaseFeaturesExtractor):

    def __init__(self, observation_space: gym.spaces.Dict, grid_features: int = 128):
        grid_shape = observation_space["grid"].shape  
        vec_dim = observation_space["vec"].shape[0]
        super().__init__(observation_space, features_dim=grid_features + vec_dim)

        # parse channel,height,width from grid_shape
        c, h, w = grid_shape
        
        self.cnn = nn.Sequential(
            nn.Conv2d(c, 16, kernel_size=(3, 3), padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(16, 32, kernel_size=(3, 3), padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 32, kernel_size=(3, 3), padding=1),
            nn.ReLU(inplace=True),
            nn.Flatten(),
        )
        with th.no_grad():
            n_flat = self.cnn(th.zeros(1, c, h, w)).shape[1]
        self.grid_head = nn.Sequential(
            nn.Linear(n_flat, grid_features),
            nn.ReLU(inplace=True),
        )

    def forward(self, observations: dict) -> th.Tensor:
        grid_feat = self.grid_head(self.cnn(observations["grid"]))
        return th.cat([grid_feat, observations["vec"]], dim=1)

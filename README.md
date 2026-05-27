# Mario PPO
engine version in gitlab frontend repo is commit:
`c84cf0aec82979345a2026a813d79e98d394143a`.

## Repository Layout

```text
.
├── README.md                    
├── quickstart.md                     # quickstart
├── requirements.txt                  # Python dependencies
├── engine/
│   └── runner.ts                     # headless engine bridge used by Python
└── src/
    ├── computing/
    │   ├── deterministic_eval_callback.py  # saves deterministic passing models
    │   ├── inference.py                    # evaluates saved PPO models
    │   └── trainer.py                      # trains the PPO model
    ├── config/
    │   └── config.py                  # action, observation, and reward settings
    └── env/
        ├── action.py                  # converts PPO actions into engine inputs
        ├── feature_extractor.py       # CNN grid extractor plus vector passthrough
        ├── headless_env.py            # Gymnasium environment wrapper
        ├── observation.py             # builds grid and vector observations
        ├── reward.py                  # computes reward and episode status
        └── runner_client.py           # manages the engine subprocess protocol
```

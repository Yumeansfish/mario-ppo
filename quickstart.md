# Quickstart

## Training

```bash
python3 -m pip install -r requirements.txt
npm install --prefix engine
PYTHONPATH=src MARIO_MAP_PATH="$(pwd)/engine/public/assets/map1.json" \
python3 src/computing/trainer.py \
  --run-name ppo_v27_map1_seed0_2_5M \
  --total-timesteps 2500000 \
  --n-envs 16 \
  --device auto
```

## Deterministic Inference

```bash
python3 -m pip install -r requirements.txt
PYTHONPATH=src MARIO_MAP_PATH="$(pwd)/engine/public/assets/map1.json" \
python3 src/computing/inference.py \
  --model checkpoints/ppo_v27_map1_seed0_2_5M/ppo_deterministic_pass.zip \
  --episodes 1 \
  --deterministic \
  --max-steps 1000 \
  --csv logs/eval_ppo_v27_map1_seed0_2_5M.csv
```

## Stochastic Inference

```bash
python3 -m pip install -r requirements.txt
PYTHONPATH=src MARIO_MAP_PATH="$(pwd)/engine/public/assets/map1.json" \
python3 src/computing/inference.py \
  --model checkpoints/ppo_v27_map1_seed0_2_5M/ppo_deterministic_pass.zip \
  --episodes 50 \
  --max-steps 1000 \
  --csv logs/eval_ppo_v27_map1_seed0_2_5M_stochastic.csv
```

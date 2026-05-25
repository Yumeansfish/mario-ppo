import { readFileSync } from "node:fs";
import * as readline from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const consoleSink = (...args: unknown[]) => {
  try {
    process.stderr.write(
      args
        .map((arg) =>
          typeof arg === "string" ? arg : JSON.stringify(arg),
        )
        .join(" ") + "\n",
    );
  } catch {}
};
console.log = consoleSink;
console.info = consoleSink;
console.warn = consoleSink;
console.error = consoleSink;
console.debug = consoleSink;

import { createHeadlessLevelRuntime } from "./src/components/levelPlayer/ecs/headlessRuntime/create.js";
import {
  updateHeadlessLevel,
  type LevelRuntime,
} from "./src/components/levelPlayer/ecs/headlessRuntime/update.js";
import { createLevelDataFromTiledJson } from "./src/components/levelPlayer/ecs/headlessRuntime/createLevelDataFromTiledJson.js";
import { CT } from "./src/components/levelPlayer/ecs/core/ComponentTypes.js";
import { LifeState } from "./src/components/levelPlayer/ecs/components/ComponentEnum.js";
import type {
  LevelData,
  TiledMapJson,
} from "./src/components/levelPlayer/ecs/headlessRuntime/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MAP = resolve(here, "public/assets/map1.json");
const MAP_PATH = process.env.MARIO_MAP_PATH || DEFAULT_MAP;

const mapJson = JSON.parse(readFileSync(MAP_PATH, "utf8")) as TiledMapJson;
mapJson.properties ??= [
  { name: "ClearConditionType", value: "none" },
  { name: "ClearConditionAmount", value: "0" },
];
const levelData: LevelData = createLevelDataFromTiledJson(mapJson);

const GRID_W = mapJson.width;
const GRID_H = mapJson.height;
const TILE_SIZE = mapJson.tilewidth;
const tileGrid = new Uint8Array(GRID_W * GRID_H);
for (const tile of levelData.worldTiles) {
  const x = Math.floor(tile.x / TILE_SIZE);
  const y = Math.floor(tile.y / TILE_SIZE);
  if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
    tileGrid[y * GRID_W + x] = tile.label === "Semisolid" ? 2 : 1;
  }
}
const tileGridB64 = Buffer.from(tileGrid).toString("base64");

let runtime: LevelRuntime | null = null;
let frame = 0;

function getDoorPos(): { x: number; y: number } {
  if (!runtime) return { x: 7168, y: 1536 };
  const entities = runtime.registry.view([CT.Door, CT.Transform]);
  const transform = runtime.registry.getComponent(entities[0], CT.Transform);
  return { x: transform?.x ?? 7168, y: transform?.y ?? 1536 };
}

function makeObs(includeStatic: boolean): unknown {
  if (!runtime) return null;
  const player = runtime.playerEntity;
  const transform = runtime.registry.getComponent(player, CT.Transform);
  const physics = runtime.registry.getComponent(player, CT.Physics);
  const control = runtime.registry.getComponent(player, CT.Player);
  const body = physics?.body;

  const enemies = runtime.registry.view([CT.Enemy, CT.Transform]).map((entity) => {
    const enemyTransform = runtime!.registry.getComponent(entity, CT.Transform);
    const enemyPhysics = runtime!.registry.getComponent(entity, CT.Physics);
    let kind = 0;
    if (runtime!.registry.hasComponent(entity, CT.Slime)) kind = 1;
    else if (runtime!.registry.hasComponent(entity, CT.Snail)) kind = 2;
    else if (runtime!.registry.hasComponent(entity, CT.Bee)) kind = 3;
    if (runtime!.registry.hasComponent(entity, CT.Shell)) kind = 4;
    return {
      x: enemyTransform?.x ?? 0,
      y: enemyTransform?.y ?? 0,
      vx: enemyPhysics?.body?.velocity.x ?? 0,
      vy: enemyPhysics?.body?.velocity.y ?? 0,
      k: kind,
    };
  });

  const obs: any = {
    type: "obs",
    frame,
    isComplete: runtime.levelState.isComplete,
    gameOver: runtime.levelState.gameOver,
    doorOpen: runtime.levelState.doorOpen,
    player: {
      x: transform?.x ?? 0,
      y: transform?.y ?? 0,
      vx: body?.velocity.x ?? 0,
      vy: body?.velocity.y ?? 0,
      onGround: control?.isOnGround ?? false,
      invincible: control?.isInvincible ?? false,
      alive: (control?.lifeState ?? LifeState.ALIVE) === LifeState.ALIVE,
    },
    enemies,
    door: getDoorPos(),
  };

  if (includeStatic) {
    obs.mapSize = runtime.mapSize;
    obs.tile = {
      w: GRID_W,
      h: GRID_H,
      size: TILE_SIZE,
      grid: tileGridB64,
    };
  }

  return obs;
}

function send(msg: unknown): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

process.stdout.on("error", (err: any) => {
  if (err.code === "EPIPE") process.exit(0);
});

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  let msg: any;
  try {
    msg = JSON.parse(line);
  } catch {
    send({ type: "error", message: "bad json" });
    return;
  }

  if (msg.cmd === "reset") {
    runtime = createHeadlessLevelRuntime(levelData);
    frame = 0;
    send(makeObs(true));
    return;
  }

  if (msg.cmd === "step") {
    if (!runtime) {
      send({ type: "error", message: "no runtime; reset first" });
      return;
    }
    updateHeadlessLevel(runtime, { input: msg.input ?? {} });
    frame++;
    send(makeObs(false));
    return;
  }

  if (msg.cmd === "ping") {
    send({ type: "pong" });
    return;
  }

  if (msg.cmd === "shutdown") {
    process.exit(0);
  }

  send({ type: "error", message: "unknown cmd" });
});

rl.on("close", () => process.exit(0));

send({
  type: "ready",
  mapSize: levelData.mapSize,
  gridW: GRID_W,
  gridH: GRID_H,
  tile: TILE_SIZE,
});

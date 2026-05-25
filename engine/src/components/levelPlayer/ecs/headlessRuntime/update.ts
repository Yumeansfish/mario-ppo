import Matter from "matter-js";
import { syncTransformsFromMatter } from "../adapter/matterAdapter";
import type { Registry } from "../core/Registry";
import type { EventQueue, GameEvent } from "../eventQueue";
import type { LevelStateResource } from "../resources/levelState";
import type { Scheduler } from "../resources/scheduler";
import {
  playerOperationFromInput,
  type PlayerInputState,
  type PlayerOperation,
} from "../systems/input/playerControlInputSystem";
import { carrySystem } from "../systems/carrySystem";
import { horizontalMovementSystem } from "../systems/movement/horizontalMovementSystem";
import { horizontalFlyerSystem } from "../systems/movement/horizontalFlyerSystem";
import { playerGroundContactSystem } from "../systems/contact/playerGroundContactSystem";
import { playerMovementSystem } from "../systems/movement/playerMovementSystem";
import { playerSemisolidSystem } from "../systems/contact/playerSemisolidSystem";
import { playerWallContactSystem } from "../systems/contact/playerWallContactSystem";
import { playerShellCarryInputSystem } from "../systems/input/playerShellCarryInputSystem";
import { worldBoundsSystem } from "../systems/worldBoundsSystem";
import { getMovementBlockingBodies } from "../adapter/matterQueryUtils";
import { collisionDynamicFilterSystem } from "../systems/collision/collisionDynamicFilterSystem";
import { playerDamageEventSystem } from "../systems/lifecycle/playerDamageSystem";
import { processRuntimeEvents } from "../systems/runtimeEvents";
import { gravitySystem } from "../systems/gravitySystem";

// Runtime is the game state without Phaser.
// ECS + Matter + events + scheduler and level state.
export type LevelRuntime = {
  engine: Matter.Engine;
  world: Matter.World;
  registry: Registry;
  events: EventQueue;
  scheduler: Scheduler;
  levelState: LevelStateResource;
  playerEntity: number;
  mapSize: {
    width: number;
    height: number;
  };
};

export type HeadlessUpdateOptions = {
  input?: PlayerInputState;
  deltaMs?: number;
};

export type HeadlessUpdateResult = {
  events: GameEvent[];
  doorOpen: boolean;
  isComplete: boolean;
  gameOver: boolean;
};

const DEFAULT_DELTA_MS = 1000 / 60;

export function updateHeadlessLevel(
  runtime: LevelRuntime,
  options: HeadlessUpdateOptions = {},
): HeadlessUpdateResult {
  const events = updateRuntime(runtime, {
    input: playerOperationFromInput(options.input),
    deltaMs: options.deltaMs ?? DEFAULT_DELTA_MS,
    skipPlayerInput:
      runtime.levelState.isComplete || runtime.levelState.gameOver,
  });

  processRuntimeEvents(runtime, events);
  syncTransformsFromMatter(runtime.registry);

  return {
    events,
    doorOpen: runtime.levelState.doorOpen,
    isComplete: runtime.levelState.isComplete,
    gameOver: runtime.levelState.gameOver,
  };
}

// Move the runtime forward by one tick.
export function updateRuntime(
  runtime: LevelRuntime,
  options: {
    input: PlayerOperation;
    deltaMs: number;
    skipPlayerInput: boolean;
  },
): GameEvent[] {
  const groundBodies: Matter.Body[] = getMovementBlockingBodies(runtime.world);

  playerWallContactSystem(
    runtime.registry,
    runtime.engine,
    runtime.playerEntity,
  );
  playerGroundContactSystem(
    runtime.registry,
    runtime.engine,
    runtime.playerEntity,
  );
  horizontalMovementSystem(runtime.registry, groundBodies);
  horizontalFlyerSystem(runtime.registry, groundBodies);

  if (!options.skipPlayerInput) {
    playerShellCarryInputSystem(runtime.registry, options.input, runtime.events);
    playerMovementSystem(runtime.registry, options.input);
  }
  carrySystem({
    registry: runtime.registry,
    levelState: runtime.levelState,
    world: runtime.world,
  });

  collisionDynamicFilterSystem({
    registry: runtime.registry,
    playerEntity: runtime.playerEntity,
  });
  gravitySystem(runtime.registry);
  Matter.Engine.update(runtime.engine, options.deltaMs);
  playerWallContactSystem(
    runtime.registry,
    runtime.engine,
    runtime.playerEntity,
  );
  playerGroundContactSystem(
    runtime.registry,
    runtime.engine,
    runtime.playerEntity,
  );
  playerSemisolidSystem({
    registry: runtime.registry,
    world: runtime.world,
    playerEntity: runtime.playerEntity,
  });
  runtime.scheduler.update(options.deltaMs);
  worldBoundsSystem({
    world: runtime.world,
    registry: runtime.registry,
    events: runtime.events,
    levelState: runtime.levelState,
    playerEntity: runtime.playerEntity,
    levelBottom: runtime.mapSize.height,
    levelRight: runtime.mapSize.width,
  });

  const physicsEvents = runtime.events.drain();
  playerDamageEventSystem(
    runtime.registry,
    physicsEvents,
    runtime.scheduler,
    runtime.events,
  );

  return [...physicsEvents, ...runtime.events.drain()];
}

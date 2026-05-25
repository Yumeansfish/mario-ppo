import type * as Matter from "matter-js";
import type { Registry } from "../core/Registry";
import type { GameEvent } from "../eventQueue";
import type { LevelStateResource } from "../resources/levelState";
import type { Scheduler } from "../resources/scheduler";
import { carryEventSystem } from "./carrySystem";
import { levelStateSystem } from "./lifecycle/levelStateSystem";
import { horizontalMovementEventSystem } from "./movement/horizontalMovementSystem";
import { horizontalFlyerEventSystem } from "./movement/horizontalFlyerSystem";
import { playerMovementEventSystem } from "./movement/playerMovementSystem";

export type RuntimeEventContext = {
  registry: Registry;
  levelState: LevelStateResource;
  scheduler: Scheduler;
  world: Matter.World;
};

export function processRuntimeEvents(
  runtime: RuntimeEventContext,
  events: GameEvent[],
): void {
  horizontalMovementEventSystem(runtime.registry, events);
  horizontalFlyerEventSystem(runtime.registry, events);
  playerMovementEventSystem(runtime.registry, events);
  levelStateSystem(runtime.registry, runtime.levelState, events);
  carryEventSystem(runtime, events);
}

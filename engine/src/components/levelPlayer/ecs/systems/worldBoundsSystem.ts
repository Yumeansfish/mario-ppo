import Matter from "matter-js";
import { destroyPhysicsEntity, getPhysicsBody } from "../adapter/matterAdapter";
import * as Comp from "../components";
import { CT } from "../core/ComponentTypes";
import type { Registry } from "../core/Registry";
import type { EventQueue } from "../eventQueue";
import type { LevelStateResource } from "../resources/levelState";
import { isBodyBelowY, isBodyOutOfWorld } from "../adapter/matterQueryUtils";

export type WorldBoundsContext = {
  world: Matter.World;
  registry: Registry;
  events: EventQueue;
  levelState: LevelStateResource;
  playerEntity: number;
  levelBottom: number;
  levelRight: number;
};

export function worldBoundsSystem(context: WorldBoundsContext): void {
  emitGameOverIfPlayerBelowLevel(context);
  cleanupOutOfBoundsEntities(context);
}

/**
 * if player below the bottom of the map emit gameOver
 * to levelState system
 */
function emitGameOverIfPlayerBelowLevel(context: WorldBoundsContext): void {
  if (context.levelState.gameOver) return;

  const body = getPhysicsBody(context.registry, context.playerEntity) as
    | Matter.Body
    | undefined;
  if (!body) return;

  if (isBodyBelowY(body, context.levelBottom)) {
    context.events.emit({ type: "GameOver" });
  }
}

/**
 * emit enemyKilled and destroy the entity if non-player
 * out of bound
 */
function cleanupOutOfBoundsEntities(context: WorldBoundsContext): void {
  const entities = context.registry.view([CT.OutOfBounds, CT.Physics]);

  for (const entity of entities) {
    const outOfBounds = context.registry.getComponent(
      entity,
      CT.OutOfBounds,
    );
    const physics = context.registry.getComponent(
      entity,
      CT.Physics,
    );
    const body = physics?.body;

    if (!outOfBounds || !body || !isBodyOutOfWorld(body, context.levelBottom, context.levelRight)) {
      continue;
    }

    if (outOfBounds.enemyKilledType) {
      context.events.emit({
        type: "EnemyKilled",
        enemyType: outOfBounds.enemyKilledType,
      });
    }

    const shell = context.registry.getComponent(entity, CT.Shell);
    shell?.respawnTimer?.remove?.();

    destroyPhysicsEntity(context.world, context.registry, entity);
  }
}

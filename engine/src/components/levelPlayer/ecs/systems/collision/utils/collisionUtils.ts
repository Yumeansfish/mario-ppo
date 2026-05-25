import * as Comp from "../../../components";
import type { Registry } from "../../../core/Registry";
import { CT } from "../../../core/ComponentTypes";
import type {
  CollisionHandlerContext,
  CollisionPair,
} from "../collisionRouterSystem";
import { spawnShellFromEnemy } from "./shellStateMachine";
import {
  destroyPhysicsEntity,
  getPhysicsBody,
} from "../../../adapter/matterAdapter";
import {
  emitBoxDestroyed,
  emitCoinCollected,
  emitEnemyKilled,
  requestBurstForEntity,
  requestCoinPop,
} from "./collisionEvents";
import { Bounds } from "matter-js";

export function isSideContact(pair: CollisionPair): boolean {
  return Math.abs(pair.collision.normal.x) > 0.5;
}

export function isVerticalContact(pair: CollisionPair): boolean {
  return Math.abs(pair.collision.normal.x) <= 0.5;
}

export function isPlayerStomp(
  playerBody: Matter.Body,
  pair: CollisionPair,
): boolean {
  return playerBody.velocity.y > 0 && isVerticalContact(pair);
}

export function isPlayerJumpHitting(
  playerBody: Matter.Body,
  pair: CollisionPair,
): boolean {
  return playerBody.velocity.y < 0 && isVerticalContact(pair);
}

export function getEnemyType(registry: Registry, entity: number): string {
  if (registry.hasComponent(entity, CT.Snail)) return "Enemy_Snail";
  if (registry.hasComponent(entity, CT.Slime)) return "Enemy_Slime_Normal";
  if (registry.hasComponent(entity, CT.Bee)) return "Enemy_Bee";
  return "Enemy";
}

/**
 * helper for destory the finded enemy
 */
type CrushEnemyOptions = {
  transformSnailToShell?: boolean;
};

export function crushEnemy(
  context: CollisionHandlerContext,
  enemyEntity: number,
  options: CrushEnemyOptions = {},
): void {
  const transformSnailToShell = options.transformSnailToShell ?? true;
  const registry = context.registry;
  const isSnail = registry.hasComponent(enemyEntity, CT.Snail);
  if (isSnail && transformSnailToShell) {
    // snail trans to shell is not an enemy kill
    // spawnShellFromEnemy can destroy the old snail entity
    spawnShellFromEnemy(context, enemyEntity);
    return;
  }
  requestBurstForEntity(context, enemyEntity);
  emitEnemyKilled(context, getEnemyType(registry, enemyEntity));
  destroyPhysicsEntity(context.world, registry, enemyEntity);
}

/**
 * main process of player/shell -> box
 * 1. request burst effect to animation system
 * 2. pop coin in the box if box has coin
 * 3. destroy box
 * 4. kill enemy on box
 */
export function breakDestructibleBox(
  context: CollisionHandlerContext,
  boxEntity: number,
  boxBounds: Bounds,
): void {
  const registry = context.registry;
  const box = registry.getComponent(
    boxEntity,
    CT.DestructibleBox,
  );

  const body = getPhysicsBody(registry, boxEntity);

  if (!box || !body) return;
  requestBurstForEntity(context, boxEntity);

  if (box.content && box.content !== "none") {
    requestCoinPop(context, body.position.x, body.position.y, box.content);
    emitCoinCollected(context, box.content, { animated: true });
  }

  emitBoxDestroyed(context, box.content);
  destroyPhysicsEntity(context.world, registry, boxEntity);
  findEnemiesOnBoxAndKill(context, boxBounds.min, boxBounds.max);
}

/**
 * helper for find enemy standing on box and crush it
 */
export function findEnemiesOnBoxAndKill(
  context: CollisionHandlerContext,
  boxMin: { x: number; y: number },
  boxMax: { x: number; y: number },
): void {
  const registry = context.registry;
  const enemyEntities = registry.view([CT.Enemy, CT.Physics]);

  for (const enemyEntity of enemyEntities) {
    const physics = registry.getComponent(enemyEntity, CT.Physics);
    const enemyBody = physics?.body;
    if (!enemyBody) continue;

    const enemyX = enemyBody.position.x;
    const feetY = enemyBody.bounds.max.y;

    const isStandingOnBox =
      enemyX >= boxMin.x - 8 &&
      enemyX <= boxMax.x + 8 &&
      Math.abs(feetY - boxMin.y) <= 20;

    if (isStandingOnBox) crushEnemy(context, enemyEntity);
  }
}

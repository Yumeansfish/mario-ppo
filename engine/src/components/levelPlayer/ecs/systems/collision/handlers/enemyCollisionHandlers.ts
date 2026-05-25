import type {
  CollisionHandlerContext,
  MatchedCollision,
} from "../collisionRouterSystem";
import {
  requestHorizontalFlyerReverse,
  requestHorizontalWalkerReverse,
} from "../utils/collisionEvents";
import { isSideContact } from "../utils/collisionUtils";
import { CT } from "../../../core/ComponentTypes";
import { getPhysicsBody } from "../../../adapter/matterAdapter";

/**
 * enemy -> enemy
 * check collision dir and reverse both
 */
export function handleEnemyEnemy(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  if (isSideContact(collision.pair)) {
    reverseEnemyMovement(context, collision.subject);
    reverseEnemyMovement(context, collision.target);
  }
}

/**
 * if enemy -> box collision in correct angle
 * request reverse from movementsystem
 */
export function handleEnemyDestructibleBox(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  if (
    isSideContact(collision.pair) &&
    isObstacleBlockingEnemyMovement(
      context,
      collision.subject,
      collision.target,
    )
  ) {
    reverseEnemyMovement(context, collision.subject);
  }
}

/**
 * enemy -> passive hazard
 * hazard sensors reverse enemies without physically blocking them
 */
export function handleEnemyPassiveHazard(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  const hazard = context.registry.getComponent(collision.target, CT.Hazard);
  if (!hazard?.active || !hazard.targetEnemy) return;

  reverseEnemyMovement(context, collision.subject);
}

function reverseEnemyMovement(
  context: CollisionHandlerContext,
  entity: number,
): void {
  const hasWalker = context.registry.getComponent(entity, CT.HorizontalWalker);
  const hasFlyer = context.registry.getComponent(entity, CT.HorizontalFlyer);

  if (hasWalker) {
    requestHorizontalWalkerReverse(context, entity);
  } else if (hasFlyer) {
    requestHorizontalFlyerReverse(context, entity);
  }
}

function isObstacleBlockingEnemyMovement(
  context: CollisionHandlerContext,
  enemyEntity: number,
  obstacleEntity: number,
): boolean {
  const registry = context.registry;
  const enemyBody = getPhysicsBody(registry, enemyEntity);
  const obstacleBody = getPhysicsBody(registry, obstacleEntity);
  if (!enemyBody || !obstacleBody) return false;

  const direction = getEnemyMovementDirection(context, enemyEntity);
  if (direction === 0) return false;

  const obstacleIsInMovementDirection =
    direction > 0
      ? obstacleBody.position.x > enemyBody.position.x
      : obstacleBody.position.x < enemyBody.position.x;

  const obstacleBlocksEnemyCenterline =
    obstacleBody.bounds.min.y <= enemyBody.position.y &&
    obstacleBody.bounds.max.y >= enemyBody.position.y;

  return obstacleIsInMovementDirection && obstacleBlocksEnemyCenterline;
}

function getEnemyMovementDirection(
  context: CollisionHandlerContext,
  entity: number,
): -1 | 0 | 1 {
  const walker = context.registry.getComponent(entity, CT.HorizontalWalker);
  if (walker?.active) return walker.direction > 0 ? 1 : -1;

  const flyer = context.registry.getComponent(entity, CT.HorizontalFlyer);
  if (flyer?.active) return flyer.direction > 0 ? 1 : -1;

  return 0;
}

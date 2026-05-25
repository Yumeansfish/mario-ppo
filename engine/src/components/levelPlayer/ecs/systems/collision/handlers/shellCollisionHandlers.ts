import * as Comp from "../../../components";
import { CT } from "../../../core/ComponentTypes";
import { getPhysicsBody } from "../../../adapter/matterAdapter";
import type {
  CollisionHandlerContext,
  MatchedCollision,
} from "../collisionRouterSystem";
import { setVelocityX } from "../../movement/movementUtils";
import { requestHorizontalWalkerReverse } from "../utils/collisionEvents";
import {
  breakDestructibleBox,
  crushEnemy,
  isSideContact,
} from "../utils/collisionUtils";

/**
 * shell -> box
 * destroy box and reverse direction of shell
 */
export function handleShellDestructibleBox(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  const registry = context.registry;
  const shellWalker = registry.getComponent(
    collision.subject,
    CT.HorizontalWalker,
  );
  const boxBody = getPhysicsBody(registry, collision.target);
  if (!boxBody) return;
  if (shellWalker?.active && isSideContact(collision.pair)) {
    breakDestructibleBox(context, collision.target, boxBody.bounds);
    requestHorizontalWalkerReverse(context, collision.subject);
  }
}

/**
 * handler for shell -> enemy
 * if the shell is active
 * crush the target enemy
 * and reverse the shell
 */
export function handleShellEnemy(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  const shellWalker = context.registry.getComponent(
    collision.subject,
    CT.HorizontalWalker,
  );
  if (shellWalker && shellWalker.active) {
    crushEnemy(context, collision.target, { transformSnailToShell: false });
    requestHorizontalWalkerReverse(context, collision.subject);
  }
}

/**
 * shell -> shell
 * active shells bounce back instead of pushing resting shells across the map
 */
export function handleShellShell(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  if (!isSideContact(collision.pair)) return;
  for (const shellEntity of [collision.subject, collision.target]) {
    const shellWalker = context.registry.getComponent(
      shellEntity,
      CT.HorizontalWalker,
    );
    if (!shellWalker) continue;

    if (shellWalker.active) {
      requestHorizontalWalkerReverse(context, shellEntity);
      continue;
    }

    const shellBody = getPhysicsBody(context.registry, shellEntity);
    if (shellBody) setVelocityX(shellBody, 0);
  }
}

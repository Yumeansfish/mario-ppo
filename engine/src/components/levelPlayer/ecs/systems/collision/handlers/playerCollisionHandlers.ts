import * as Comp from "../../../components";
import { CT } from "../../../core/ComponentTypes";
import {
  destroyPhysicsEntity,
  getPhysicsBody,
} from "../../../adapter/matterAdapter";
import type {
  CollisionHandlerContext,
  MatchedCollision,
} from "../collisionRouterSystem";
import {
  emitCoinCollected,
  emitPlayerEnteredDoor,
  requestBurstForEntity,
  requestHorizontalWalkerReverse,
  requestPlayerBounce,
  requestPlayerDamageContactEnd,
  requestPlayerDamageContactStart,
} from "../utils/collisionEvents";
import {
  breakDestructibleBox,
  crushEnemy,
  isPlayerJumpHitting,
  isPlayerStomp,
  isSideContact,
} from "../utils/collisionUtils";
import {
  restartShellRespawn,
} from "../utils/shellStateMachine";

/**
 * handler for player -> door
 */
export function handlePlayerDoor(
  context: CollisionHandlerContext,
  _collision: MatchedCollision,
): void {
  emitPlayerEnteredDoor(context);
}

/**
 * handler for player -> coin
 */
export function handlePlayerCoin(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  const registry = context.registry;
  const coinEntity = collision.target;
  const coin = registry.getComponent(coinEntity, CT.Coin);
  if (!coin) return;
  requestBurstForEntity(context, coinEntity);
  emitCoinCollected(context, coin.coinType);
  destroyPhysicsEntity(context.world, registry, coinEntity);
}

/**
 * player -> box
 * check the collision should condition
 * destroy the box
 */
export function handlePlayerDestructibleBox(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  const registry = context.registry;
  const playerBody = getPhysicsBody(registry, collision.subject);
  const boxBody = getPhysicsBody(registry, collision.target);
  if (!boxBody || !playerBody) return;
  if (isPlayerJumpHitting(playerBody, collision.pair)) {
    breakDestructibleBox(context, collision.target, boxBody.bounds);
  }
}

/**
 * handler for player -> enemy
 * if player is dropping and touch the enemy it will kill enemy
 * and play animation
 * otherwise request damageSystem to hurt player
 */
export function handlePlayerEnemy(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  const playerBody = getPhysicsBody(context.registry, collision.subject);
  if (!playerBody) return;
  if (isPlayerStomp(playerBody, collision.pair)) {
    crushEnemy(context, collision.target);
    requestPlayerBounce(context, collision.subject);
  } else {
    requestPlayerDamageContactStart(
      context,
      collision.subject,
      collision.target,
    );
  }
}

/**
 * handler for player -> enemy end
 * end the damage on player
 */
export function handlePlayerEnemyEnd(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  requestPlayerDamageContactEnd(context, collision.subject, collision.target);
}

/**
 * player -> passive hazard 
 */
export function handlePlayerHazard(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  requestPlayerDamageContactStart(context, collision.subject, collision.target);
}

export function handlePlayerHazardEnd(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  requestPlayerDamageContactEnd(context, collision.subject, collision.target);
}

/**
 * player -> shell
 * resting shell side contact kicks it
 * moving shell stomp stops it
 * moving shell side contact reverses it
 */
export function handlePlayerShell(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  const registry = context.registry;
  const shellEntity = collision.target;
  const playerEntity = collision.subject;
  const shellWalker = registry.getComponent(
    shellEntity,
    CT.HorizontalWalker,
  );
  const shell = registry.getComponent(shellEntity, CT.Shell);
  const hazard = registry.getComponent(shellEntity, CT.Hazard);
  const playerBody = getPhysicsBody(registry, playerEntity);

  if (shell?.ignorePlayerUntilContactEnd) return;
  if (!playerBody || !shellWalker) return;

  if (!shellWalker.active) {
    if (isSideContact(collision.pair)) {
      kickShellAwayFromPlayer(
        context,
        playerEntity,
        shellEntity,
        shellWalker,
        hazard,
      );
    }
    return;
  }

  // stomp will stop the shell and make player bounce
  if (isPlayerStomp(playerBody, collision.pair)) {
    stopShell(context, shellEntity, shellWalker, hazard);
    requestPlayerBounce(context, playerEntity);
    return;
  }

  // active shell contact without stomp will cause damage. catching via
  // press-edge Z is handled in playerMovementSystem; that path sets
  // shell.ignorePlayerUntilContactEnd so this handler exits early above.
  requestPlayerDamageContactStart(context, playerEntity, shellEntity);

  // side contact with active shell will reverse shell
  if (isSideContact(collision.pair)) {
    requestHorizontalWalkerReverse(context, shellEntity);
  }
}

/**
 * A moving shell becomes dangerous only after the player separates from it.
 * This prevents the kick that activates the shell from immediately dealing damage.
 */
export function handlePlayerShellEnd(
  context: CollisionHandlerContext,
  collision: MatchedCollision,
): void {
  const registry = context.registry;
  const shell = registry.getComponent(collision.target, CT.Shell);
  const shellWalker = registry.getComponent(
    collision.target,
    CT.HorizontalWalker,
  );
  const hazard = registry.getComponent(
    collision.target,
    CT.Hazard,
  );

  if (shellWalker?.active && hazard) {
    hazard.active = true;
    hazard.targetPlayer = true;
  }
  if (shell) {
    shell.ignorePlayerUntilContactEnd = false;
  }
  requestPlayerDamageContactEnd(context, collision.subject, collision.target);
}

/**
 * helper for kick shell
 */
function kickShellAwayFromPlayer(
  context: CollisionHandlerContext,
  playerEntity: number,
  shellEntity: number,
  shellWalker: Comp.HorizontalWalker,
  hazard: Comp.Hazard | undefined,
): void {
  const player = getPhysicsBody(context.registry, playerEntity);
  const shellBody = getPhysicsBody(context.registry, shellEntity);
  if (!player || !shellBody) return;
  // the kick dir depends on player position because resting shell has velocity = 0
  shellWalker.direction = player.position.x < shellBody.position.x ? 1 : -1;
  shellWalker.active = true;
  shellWalker.skipVelCheck = true;

  if (hazard) {
    hazard.active = true;
    hazard.targetEnemy = true;
    hazard.targetPlayer = false;
  }

  restartShellRespawn(context, shellEntity);
}

/**
 * make shell stop moving
 */
function stopShell(
  context: CollisionHandlerContext,
  shellEntity: number,
  shellWalker: Comp.HorizontalWalker,
  hazard: Comp.Hazard | undefined,
): void {
  shellWalker.active = false;
  shellWalker.direction = 0;
  shellWalker.skipVelCheck = false;

  if (hazard) {
    hazard.active = false;
    hazard.targetPlayer = false;
  }

  restartShellRespawn(context, shellEntity);
}

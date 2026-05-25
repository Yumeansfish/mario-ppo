import { CT } from "../../../core/ComponentTypes";
import type * as Matter from "matter-js";
import {
  destroyPhysicsEntity,
  getPhysicsBody,
} from "../../../adapter/matterAdapter";
import { spawnHeadlessEntity } from "../../../entities/spawnEntity";
import type { CollisionHandlerContext } from "../collisionRouterSystem";

const SHELL_RESPAWN_DELAY_MS = 7000;
const SHELL_RESPAWN_RETRY_DELAY_MS = 250;
const SHELL_TOP_BLOCK_TOLERANCE = 12;

type ShellStateContext = Pick<
  CollisionHandlerContext,
  "registry" | "world" | "scheduler"
>;

/**
 * create a shell,destory snail and set countdown
 */
export function spawnShellFromEnemy(
  context: CollisionHandlerContext,
  enemyEntity: number,
): void {
  const registry = context.registry;
  const body = getPhysicsBody(registry, enemyEntity);
  if (!body) return;
  const shellEntity = createEntityAtCoordinate(
    context,
    "Item_Shell",
    body.position.x,
    body.position.y,
  );
  restartShellRespawn(context, shellEntity);
  destroyPhysicsEntity(context.world, registry, enemyEntity);
}

/**
 * set countdown for shell
 */
export function restartShellRespawn(
  context: ShellStateContext,
  shellEntity: number,
): void {
  const shell = context.registry.getComponent(shellEntity, CT.Shell);
  if (!shell) return;
  shell.respawnTimer?.remove?.();
  scheduleShellRespawn(context, shellEntity, SHELL_RESPAWN_DELAY_MS);
}

/**
 * remove the countdown for shell
 */
export function pauseShellRespawn(
  context: ShellStateContext,
  shellEntity: number,
): void {
  const shell = context.registry.getComponent(shellEntity, CT.Shell);
  if (!shell) return;
  shell.respawnTimer?.remove?.();
  shell.respawnTimer = null;
}

/**
 * destory shell and create snail
 */
function transformShellToSnail(
  context: ShellStateContext,
  shellEntity: number,
): void {
  const shellWalker = context.registry.getComponent(
    shellEntity,
    CT.HorizontalWalker,
  );
  const body = getPhysicsBody(context.registry, shellEntity);
  if (!body) return;
  if (isPlayerStandingOnShell(context, body)) {
    scheduleShellRespawn(context, shellEntity, SHELL_RESPAWN_RETRY_DELAY_MS);
    return;
  }

  const snailEntity = createEntityAtCoordinate(
    context,
    "Enemy_Snail",
    body.position.x,
    body.position.y,
  );
  const snailWalker = context.registry.getComponent(
    snailEntity,
    CT.HorizontalWalker,
  );
  if (snailWalker) {
    snailWalker.direction =
      shellWalker && shellWalker.direction !== 0
        ? shellWalker.direction
        : -1;
  }
  destroyPhysicsEntity(context.world, context.registry, shellEntity);
}

function scheduleShellRespawn(
  context: ShellStateContext,
  shellEntity: number,
  delayMs: number,
): void {
  const shell = context.registry.getComponent(shellEntity, CT.Shell);
  if (!shell) return;
  shell.respawnTimer = context.scheduler.schedule(delayMs, () => {
    transformShellToSnail(context, shellEntity);
  });
}

function isPlayerStandingOnShell(
  context: ShellStateContext,
  shellBody: Matter.Body,
): boolean {
  for (const playerEntity of context.registry.view([CT.Player, CT.Physics])) {
    const playerBody = getPhysicsBody(context.registry, playerEntity);
    if (!playerBody) continue;

    const overlapsHorizontally =
      playerBody.bounds.max.x > shellBody.bounds.min.x &&
      playerBody.bounds.min.x < shellBody.bounds.max.x;
    const playerFeetY = playerBody.bounds.max.y;
    const shellTopY = shellBody.bounds.min.y;
    const isOnTop =
      playerBody.position.y < shellBody.position.y &&
      Math.abs(playerFeetY - shellTopY) <= SHELL_TOP_BLOCK_TOLERANCE;

    if (overlapsHorizontally && isOnTop) return true;
  }

  return false;
}

/**
 * helper for create entity
 */
function createEntityAtCoordinate(
  context: ShellStateContext,
  entityType: string,
  x: number,
  y: number,
): number {
  const entity = spawnHeadlessEntity(
    context.registry,
    context.world,
    entityType,
    x,
    y,
  );
  return entity;
}

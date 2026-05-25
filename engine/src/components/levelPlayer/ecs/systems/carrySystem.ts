import * as Matter from "matter-js";
import { applyCollisionMask, getPhysicsBody } from "../adapter/matterAdapter";
import {
  getBodyBoundsHalfHeight,
  getBodyBoundsHalfWidth,
  getMovementBlockingBodies,
} from "../adapter/matterQueryUtils";
import { LifeState } from "../components/ComponentEnum";
import { CT } from "../core/ComponentTypes";
import { Registry } from "../core/Registry";
import type { GameEvent } from "../eventQueue";
import type { LevelStateResource } from "../resources/levelState";
import { restartShellRespawn } from "./collision/utils/shellStateMachine";
import type { RuntimeEventContext } from "./runtimeEvents";

const SHELL_PLACEMENT_GAP = 8;
const SHELL_PLACEMENT_STEP = 12;
const SHELL_PLACEMENT_ATTEMPTS = 4;
const SHELL_PLAYER_REARM_DELAY_MS = 150;
const SHELL_THROW_MOVEMENT_THRESHOLD = 0.5;
const SHELL_WALK_THROW_SPEED = 14;
const SHELL_RUN_THROW_SPEED = 21;
const SHELL_THROW_ARC_VY = -11;

export function carryEventSystem(
  context: RuntimeEventContext,
  events: GameEvent[],
): void {
  for (const event of events) {
    switch (event.type) {
      case "ShellEquipRequested":
        equipShell(context, event.playerEntity, event.shellEntity);
        break;
      case "ShellThrowRequested":
        throwShell(
          context,
          event.playerEntity,
          event.releaseVx,
          event.isRunning,
        );
        break;
    }
  }

  detachAllCarriedShells(context.registry, context.levelState);
}

export function carrySystem(
  context: Pick<RuntimeEventContext, "registry" | "levelState" | "world">,
): void {
  const { registry, levelState } = context;
  for (const entity of registry.view([CT.Carrier, CT.Physics, CT.Player])) {
    const carrier = registry.getComponent(entity, CT.Carrier);
    const physics = registry.getComponent(entity, CT.Physics);
    const player = registry.getComponent(entity, CT.Player);
    const animator = registry.getComponent(entity, CT.Animator);
    if (!carrier || !physics || !player) continue;

    if (carrier.heldEntity == null) continue;
    if (
      player.lifeState !== LifeState.ALIVE ||
      levelState.isComplete ||
      levelState.gameOver
    ) {
      detachShell(registry, carrier.heldEntity);
      carrier.heldEntity = null;
      continue;
    }

    const playerBody = physics.body as Matter.Body | undefined;
    const shellBody = getPhysicsBody(registry, carrier.heldEntity);
    if (!playerBody || !shellBody) {
      detachShell(registry, carrier.heldEntity);
      carrier.heldEntity = null;
      continue;
    }

    const facing = animator?.flipX ? -1 : 1;
    const bob = Math.sin(Date.now() / 200) * 10;
    positionShellNearPlayer(
      context,
      playerBody,
      shellBody,
      facing,
      playerBody.position.y + carrier.offsetY + bob,
      Math.max(
        carrier.offsetX,
        getBodyBoundsHalfWidth(playerBody) +
          getBodyBoundsHalfWidth(shellBody) +
          SHELL_PLACEMENT_GAP,
      ),
    );
    Matter.Body.setVelocity(shellBody, { x: 0, y: 0 });
  }
}

function detachShell(registry : Registry, shellEntity : number) {
  if (shellEntity == null) return;
  const shellBody = getPhysicsBody(registry, shellEntity);
  const shellPhysics = registry.getComponent(shellEntity, CT.Physics);
  if (!shellBody || !shellPhysics) return;

  const restoreMask = shellPhysics.collidesWith.reduce((m : number, c : number) => m | c, 0);
  applyCollisionMask(shellBody, restoreMask);
  Matter.Body.set(shellBody, { isSensor: shellPhysics.isSensor });
  Matter.Sleeping.set(shellBody, false);
  Matter.Body.setVelocity(shellBody, { x: 0, y: 0 });
}

function equipShell(
  context: RuntimeEventContext,
  playerEntity: number,
  shellEntity: number,
): void {
  const carrier = context.registry.getComponent(
    playerEntity,
    CT.Carrier,
  );
  if (!carrier || carrier.heldEntity != null) return;

  const shell = context.registry.getComponent(shellEntity, CT.Shell);
  const shellWalker = context.registry.getComponent(
    shellEntity,
    CT.HorizontalWalker,
  );
  const hazard = context.registry.getComponent(shellEntity, CT.Hazard);
  const shellBody = getPhysicsBody(context.registry, shellEntity);
  if (!shell || !shellWalker || !hazard || !shellBody) return;

  carrier.heldEntity = shellEntity;

  hazard.active = false;
  hazard.targetPlayer = false;
  hazard.targetEnemy = false;

  shellWalker.active = false;
  shellWalker.direction = 0;
  shellWalker.skipVelCheck = false;

  // carried shells are inert so they do not collide during active ticks.
  applyCollisionMask(shellBody, 0);
  Matter.Body.set(shellBody, { isSensor: true });

  shell.respawnTimer?.remove?.();
  shell.respawnTimer = null;
  shell.ignorePlayerUntilContactEnd = false;
}

function throwShell(
  context: RuntimeEventContext,
  playerEntity: number,
  releaseVx: number,
  isRunning: boolean,
): void {
  const carrier = context.registry.getComponent(playerEntity, CT.Carrier);
  const playerPhysics = context.registry.getComponent(playerEntity, CT.Physics);
  const playerAnimator = context.registry.getComponent(playerEntity, CT.Animator);
  const shellEntity = carrier?.heldEntity ?? null;
  if (!carrier || shellEntity == null || !playerPhysics?.body) return;

  const shellWalker = context.registry.getComponent(shellEntity, CT.HorizontalWalker);
  const shell = context.registry.getComponent(shellEntity, CT.Shell);
  const hazard = context.registry.getComponent(shellEntity, CT.Hazard);
  const shellBody = getPhysicsBody(context.registry, shellEntity);
  if (!shellWalker || !shell || !hazard || !shellBody) return;

  const releaseSpeedAbs = Math.abs(releaseVx);
  const isActive = releaseSpeedAbs > SHELL_THROW_MOVEMENT_THRESHOLD;
  const facing = playerAnimator?.flipX ? -1 : 1;
  const launchSpeed = isRunning
    ? SHELL_RUN_THROW_SPEED
    : SHELL_WALK_THROW_SPEED;
  const launchVx = isActive ? facing * launchSpeed : 0;
  const launchVy = isActive ? SHELL_THROW_ARC_VY : 0;

  detachShell(context.registry, shellEntity);
  carrier.heldEntity = null;
  positionShellNearPlayer(
    context,
    playerPhysics.body,
    shellBody,
    facing,
    playerPhysics.body.position.y,
    getBodyBoundsHalfWidth(playerPhysics.body) +
      getBodyBoundsHalfWidth(shellBody) +
      SHELL_PLACEMENT_GAP,
  );

  shellWalker.direction = isActive ? facing : 0;
  shellWalker.active = isActive;
  if (isActive) {
    shellWalker.speed = launchSpeed;
  }
  shellWalker.skipVelCheck = isActive;

  hazard.active = isActive;
  hazard.targetEnemy = isActive;
  hazard.targetPlayer = false;
  shell.ignorePlayerUntilContactEnd = isActive;

  Matter.Body.setVelocity(shellBody, { x: launchVx, y: launchVy });

  if (isActive) {
    armShellAgainstPlayerAfterRelease(context, shellEntity);
  }
  restartShellRespawn(context, shellEntity);
}

function detachAllCarriedShells(
  registry: RuntimeEventContext["registry"],
  levelState: LevelStateResource,
): void {
  for (const entity of registry.view([CT.Carrier, CT.Player])) {
    const carrier = registry.getComponent(entity, CT.Carrier);
    const player = registry.getComponent(entity, CT.Player);
    if (!carrier || !player || carrier.heldEntity == null) continue;
    if (
      player.lifeState === LifeState.ALIVE &&
      !levelState.isComplete &&
      !levelState.gameOver
    ) {
      continue;
    }

    detachShell(registry, carrier.heldEntity);
    carrier.heldEntity = null;
  }
}

function armShellAgainstPlayerAfterRelease(
  context: RuntimeEventContext,
  shellEntity: number,
): void {
  context.scheduler.schedule(SHELL_PLAYER_REARM_DELAY_MS, () => {
    const shell = context.registry.getComponent(shellEntity, CT.Shell);
    const shellWalker = context.registry.getComponent(
      shellEntity,
      CT.HorizontalWalker,
    );
    const hazard = context.registry.getComponent(shellEntity, CT.Hazard);

    if (!shell || !shellWalker || !hazard) return;
    if (!shell.ignorePlayerUntilContactEnd) return;

    shell.ignorePlayerUntilContactEnd = false;
    if (shellWalker.active) {
      hazard.active = true;
      hazard.targetPlayer = true;
    }
  });
}

function positionShellNearPlayer(
  context: Pick<RuntimeEventContext, "world">,
  playerBody: Matter.Body,
  shellBody: Matter.Body,
  facing: number,
  targetY: number,
  distanceFromPlayer: number,
): void {
  const baseX = playerBody.position.x + facing * distanceFromPlayer;
  const blockingBodies = getMovementBlockingBodies(context.world).filter(
    (body) => body.id !== playerBody.id && body.id !== shellBody.id,
  );

  const candidates = [];
  for (let step = 0; step <= SHELL_PLACEMENT_ATTEMPTS; step++) {
    candidates.push({
      x: baseX - facing * step * SHELL_PLACEMENT_STEP,
      y: targetY,
    });
  }

  candidates.push({
    x: playerBody.position.x,
    y:
      playerBody.position.y -
      getBodyBoundsHalfHeight(playerBody) -
      getBodyBoundsHalfHeight(shellBody) -
      SHELL_PLACEMENT_GAP,
  });

  for (const candidate of candidates) {
    Matter.Body.setPosition(shellBody, candidate);
    if (
      !Matter.Bounds.overlaps(shellBody.bounds, playerBody.bounds) &&
      Matter.Query.collides(shellBody, blockingBodies).length === 0
    ) {
      return;
    }
  }
}

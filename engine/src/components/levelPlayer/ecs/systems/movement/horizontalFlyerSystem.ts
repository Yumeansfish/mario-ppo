import * as Matter from "matter-js";
import { Registry } from "../../core/Registry";
import { CT } from "../../core/ComponentTypes";
import * as Comp from "../../components";
import type { GameEvent } from "../../eventQueue";
import {
  hasBlockingBodyAhead,
  lockRotation,
  setVelocityX,
  setVelocityY,
} from "./movementUtils";

export function horizontalFlyerEventSystem(
  registry: Registry,
  events: GameEvent[],
): void {
  for (const event of events) {
    switch (event.type) {
      case "HorizontalFlyerReverseRequested":
        reverseFlyerForEntity(registry, event.entity);
        break;
    }
  }
}

export function horizontalFlyerSystem(
  registry: Registry,
  groundBodies: Matter.Body[],
): void {
  const entities = registry.view([CT.Bee, CT.HorizontalFlyer, CT.Physics]);

  for (const entity of entities) {
    const flyer = registry.getComponent(entity, CT.HorizontalFlyer)!;
    const physics = registry.getComponent(entity, CT.Physics);
    const body = physics?.body as Matter.Body | undefined;
    if (!physics || !body) continue;

    if (!flyer.active) {
      stopHorizontalFlyer(body);
      continue;
    }

    if (isAtWall(body, physics, flyer, groundBodies)) {
      reverseFlyer(flyer);
    }

    applyFlyerMovement(body, flyer);
    syncFlyerRenderState(registry, entity, flyer);
  }
}

function reverseFlyerForEntity(registry: Registry, entity: number): void {
  const flyer = registry.getComponent(entity, CT.HorizontalFlyer);
  if (flyer) {
    reverseFlyer(flyer);
  }
}

function reverseFlyer(flyer: Comp.HorizontalFlyer): void {
  flyer.direction *= -1;
}

function isAtWall(
  body: Matter.Body,
  physics: Comp.Physics,
  flyer: Comp.HorizontalFlyer,
  groundBodies: Matter.Body[],
): boolean {
  return hasBlockingBodyAhead(
    groundBodies,
    body,
    physics,
    flyer.direction,
  );
}

function syncFlyerRenderState(
  registry: Registry,
  entity: number,
  flyer: Comp.HorizontalFlyer,
): void {
  const animator = registry.getComponent(entity, CT.Animator);
  if (animator) animator.flipX = flyer.direction > 0;
}

function stopHorizontalFlyer(body: Matter.Body): void {
  setVelocityX(body, 0);
  setVelocityY(body, 0);
  lockRotation(body);
}

function applyFlyerMovement(
  body: Matter.Body,
  flyer: Comp.HorizontalFlyer,
): void {
  setVelocityX(body, flyer.speed * flyer.direction);
  setVelocityY(body, 0);
  lockRotation(body);
}

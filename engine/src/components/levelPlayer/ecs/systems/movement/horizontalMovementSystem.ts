import Matter from "matter-js";
import { Registry } from "../../core/Registry";
import { CT } from "../../core/ComponentTypes";
import * as Comp from "../../components";
import type { GameEvent } from "../../eventQueue";
import { hasBodyAtPoint } from "../../adapter/matterQueryUtils";
import { hasBlockingBodyAhead, lockRotation, setVelocityX } from "./movementUtils";

export function horizontalMovementEventSystem(
  registry: Registry,
  events: GameEvent[],
): void {
  for (const event of events) {
    switch (event.type) {
      case "HorizontalWalkerReverseRequested":
        reverseWalkerForEntity(registry, event.entity);
        break;
    }
  }
}

export function horizontalMovementSystem(
  registry: Registry,
  groundBodies: Matter.Body[],
) {
  const entities = registry.view([CT.HorizontalWalker, CT.Physics]);

  for (const entity of entities) {
    const walker = registry.getComponent(
      entity,
      CT.HorizontalWalker,
    );
    const physics = registry.getComponent(entity, CT.Physics);
    const body = physics?.body;
    if (!walker || !physics || !body) continue;

    if (!walker.active) {
      stopHorizontalWalker(body);
      continue;
    }

    if (
      walker.turnAtLedge &&
      isLedgeAhead(body, physics, walker, groundBodies)
    ) {
      reverseWalker(walker);
    } else if (walker.skipVelCheck) {
      walker.skipVelCheck = false;
    } else if (isAtWall(body, physics, walker, groundBodies)) {
      reverseWalker(walker);
    }

    applyWalkerMovement(body, walker);
    syncWalkerRenderState(registry, entity, walker);
  }
}

//Helper for hanlde movement
function isLedgeAhead(
  body: Matter.Body,
  physics: Comp.Physics,
  walker: Comp.HorizontalWalker,
  groundBodies: Matter.Body[],
): boolean {
  const checkX = body.position.x + walker.direction * (physics.width * 0.5 + 4);
  const checkY = body.position.y + physics.height * 0.5 + 8;
  const ledgeAhead = !hasBodyAtPoint(groundBodies, { x: checkX, y: checkY });

  return ledgeAhead;
}

/**
 * velocity heuristic + query to check whether at wall
 */
function isAtWall(
  body: Matter.Body,
  physics: Comp.Physics,
  walker: Comp.HorizontalWalker,
  groundBodies: Matter.Body[],
): boolean {
  const vx = body.velocity.x;
  const velocityBlocked =
    (walker.direction > 0 && vx < walker.speed * 0.5) ||
    (walker.direction < 0 && vx > -walker.speed * 0.5);
  const wallAhead = hasBlockingBodyAhead(
    groundBodies,
    body,
    physics,
    walker.direction,
  );
  return wallAhead && velocityBlocked;
}

/**
 * reverse dir and set skip velocity check
 */
function reverseWalker(walker: Comp.HorizontalWalker): void {
  walker.direction *= -1;
  walker.skipVelCheck = true;
}

function reverseWalkerForEntity(registry: Registry, entity: number): void {
  const walker = registry.getComponent(
    entity,
    CT.HorizontalWalker,
  );
  if (walker) reverseWalker(walker);
}

function syncWalkerRenderState(
  registry: Registry,
  entity: number,
  walker: Comp.HorizontalWalker,
): void {
  const animator = registry.getComponent(entity, CT.Animator);
  if (animator) animator.flipX = walker.direction > 0;
}

function stopHorizontalWalker(body: Matter.Body): void {
  setVelocityX(body, 0);
  lockRotation(body);
}

function applyWalkerMovement(
  body: Matter.Body,
  walker: Comp.HorizontalWalker,
): void {
  {
    setVelocityX(body, walker.speed * walker.direction);
    lockRotation(body);
  }
}

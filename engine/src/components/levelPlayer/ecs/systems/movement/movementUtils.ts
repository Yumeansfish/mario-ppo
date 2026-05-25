import Matter from "matter-js";
import { hasBodyAtPoint } from "../../adapter/matterQueryUtils";
import type { Physics } from "../../components/ComponentClasses";

export function setVelocityX(body: Matter.Body, x: number): void {
  Matter.Body.setVelocity(body, { x, y: body.velocity.y });
}

export function setVelocityY(body: Matter.Body, y: number): void {
  Matter.Body.setVelocity(body, { x: body.velocity.x, y });
}

export function lockRotation(body: Matter.Body): void {
  Matter.Body.setAngularVelocity(body, 0);
  Matter.Body.setAngle(body, 0);
}

export function hasBlockingBodyAhead(
  blockingBodies: Matter.Body[],
  body: Matter.Body,
  physics: Physics,
  direction: number,
): boolean {
  const aheadX = body.position.x + direction * (physics.width * 0.5 + 4);
  return hasBodyAtPoint(blockingBodies, {
    x: aheadX,
    y: body.position.y,
  });
}

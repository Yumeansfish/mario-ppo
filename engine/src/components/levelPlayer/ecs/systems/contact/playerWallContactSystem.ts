import type * as Matter from "matter-js";
import {
  getActiveCollisionPairs,
  getOtherBodyInPair,
  isSemisolidBody,
} from "../../adapter/matterQueryUtils";
import { getPhysicsBody } from "../../adapter/matterAdapter";
import {
  HORIZONTAL_DIRECTION,
  type ActiveHorizontalDirection,
} from "../../components/ComponentClasses";
import { CT } from "../../core/ComponentTypes";
import type { Registry } from "../../core/Registry";

const NON_WALL_CONTACT_LABELS = new Set([
  "player",
  "enemy",
  "shell",
  "coin",
]);

export function playerWallContactSystem(
  registry: Registry,
  engine: Matter.Engine,
  playerEntity: number,
): void {
  const control = registry.getComponent(playerEntity, CT.Player);
  const playerBody = getPhysicsBody(registry, playerEntity);
  if (!control || !playerBody) return;

  let touchingLeftWall = false;
  let touchingRightWall = false;

  for (const pair of getActiveCollisionPairs(engine)) {
    const otherBody = getOtherBodyInPair(pair, playerBody);
    if (!otherBody) continue;

    const bodyCanBeWall = isWallContactCandidate(otherBody);
    if (!bodyCanBeWall) continue;

    const direction = getWallDirection(playerBody, otherBody, pair);
    const touchesLeftWall = direction === HORIZONTAL_DIRECTION.LEFT;
    const touchesRightWall = direction === HORIZONTAL_DIRECTION.RIGHT;

    if (touchesLeftWall) touchingLeftWall = true;
    if (touchesRightWall) touchingRightWall = true;
  }

  const isTouchingNoWallOrBothWalls = touchingLeftWall === touchingRightWall;
  control.wallContactDirection =
    isTouchingNoWallOrBothWalls
      ? HORIZONTAL_DIRECTION.NONE
      : touchingLeftWall
        ? HORIZONTAL_DIRECTION.LEFT
        : HORIZONTAL_DIRECTION.RIGHT;
}

function isWallContactCandidate(body: Matter.Body): boolean {
  const bodyIsSensor = body.isSensor;
  const bodyIsSemisolid = isSemisolidBody(body);
  const bodyIsNonWallLabel = NON_WALL_CONTACT_LABELS.has(body.label);

  return !bodyIsSensor && !bodyIsSemisolid && !bodyIsNonWallLabel;
}

function getWallDirection(
  playerBody: Matter.Body,
  wallBody: Matter.Body,
  pair: Matter.Pair,
): ActiveHorizontalDirection | typeof HORIZONTAL_DIRECTION.NONE {
  const normal = pair.collision.normal;
  const contactIsHorizontal = Math.abs(normal.x) > Math.abs(normal.y);
  if (!contactIsHorizontal) return HORIZONTAL_DIRECTION.NONE;

  const wallIsLeftOfPlayer = wallBody.position.x < playerBody.position.x;
  return wallIsLeftOfPlayer
    ? HORIZONTAL_DIRECTION.LEFT
    : HORIZONTAL_DIRECTION.RIGHT;
}

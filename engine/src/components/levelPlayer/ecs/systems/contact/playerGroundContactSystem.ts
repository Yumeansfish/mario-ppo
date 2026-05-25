import type * as Matter from "matter-js";
import {
  getActiveCollisionPairs,
  getOtherBodyInPair,
  isSemisolidBody,
} from "../../adapter/matterQueryUtils";
import { getPhysicsBody } from "../../adapter/matterAdapter";
import { CT } from "../../core/ComponentTypes";
import type { Registry } from "../../core/Registry";

const NON_GROUND_CONTACT_LABELS = new Set([
  "player",
  "enemy",
  "coin",
]);

/**
 * update whether player is on ground per tick
 */
export function playerGroundContactSystem(
  registry: Registry,
  engine: Matter.Engine,
  playerEntity: number,
): void {
  const control = registry.getComponent(playerEntity, CT.Player);
  const playerBody = getPhysicsBody(registry, playerEntity);
  if (!control || !playerBody) return;

  //TODO:what the usage of tihs field?
  if (control.forceGroundState !== null) {
    control.isOnGround = control.forceGroundState;
    return;
  }

  control.isOnGround = getActiveCollisionPairs(engine).some((pair) => {
    const otherBody = getOtherBodyInPair(pair, playerBody);
    if (!otherBody) return false;

    return (
      isGroundContactCandidate(registry, otherBody) &&
      isGroundContact(playerBody, otherBody, pair)
    );
  });
}

/**
 * check whether the contact body can be a ground
 */
function isGroundContactCandidate(
  registry: Registry,
  body: Matter.Body,
): boolean {
  if (body.isSensor || isSemisolidBody(body)) return false;
  if (body.label === "shell") return isRestingShellBody(registry, body);
  return !NON_GROUND_CONTACT_LABELS.has(body.label);
}


function isRestingShellBody(registry: Registry, body: Matter.Body): boolean {
  const entity = registry.getEntityByBodyId(body.id);
  if (entity === undefined) return false;

  const shell = registry.getComponent(entity, CT.Shell);
  const walker = registry.getComponent(entity, CT.HorizontalWalker);
  if (!shell || !walker) return false;

  return !walker.active;
}


function isGroundContact(
  playerBody: Matter.Body,
  groundBody: Matter.Body,
  pair: Matter.Pair,
): boolean {
  const normal = pair.collision.normal;
  const contactIsVertical = Math.abs(normal.y) > Math.abs(normal.x);
  const groundIsBelowPlayer = groundBody.position.y > playerBody.position.y;

  return contactIsVertical && groundIsBelowPlayer;
}

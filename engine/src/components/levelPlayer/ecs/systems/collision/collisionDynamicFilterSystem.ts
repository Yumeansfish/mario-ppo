import Matter from "matter-js";
import { applyCollisionMask } from "../../adapter/matterAdapter";
import { LifeState } from "../../components/ComponentEnum";
import { CT } from "../../core/ComponentTypes";
import type { Registry } from "../../core/Registry";
import { CATEGORY_SEMISOLID } from "../../resources/physicsConfig";

export type CollisionFilterContext = {
  registry: Registry;
  playerEntity: number;
};

/**
 * Dynamic filter for player collision.
 * Semisolid landing is handled outside Matter's resolver.
 */
export function collisionDynamicFilterSystem(
  context: CollisionFilterContext,
): void {
  updatePlayerCollisionMask(context);
}

/**
 * Applies the active player collision mask.
 */
function updatePlayerCollisionMask(context: CollisionFilterContext): void {
  const physics = context.registry.getComponent(
    context.playerEntity,
    CT.Physics,
  );
  const body = physics?.body as Matter.Body | undefined;
  if (!body) return;

  const control = context.registry.getComponent(
    context.playerEntity,
    CT.Player,
  );
  const filter = context.registry.getComponent(
    context.playerEntity,
    CT.PlayerCollisionFilter,
  );
  if (!filter) return;

  const isDying = control?.lifeState === LifeState.DYING;
  if (control?.noclipActive) {
    applyCollisionMask(body, 0);
    return;
  }
  const mask = isDying
    ? filter.disabledMask
    : body.velocity.y < 0
      ? filter.risingMask
      : filter.normalMask;

  applyCollisionMask(body, mask & ~CATEGORY_SEMISOLID);
}

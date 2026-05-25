import Matter from "matter-js";
import { CT } from "../core/ComponentTypes";
import type { Registry } from "../core/Registry";
import { GRAVITY, GRAVITY_SCALE } from "../resources/physicsConfig";

/**
 * apply gravity based on physics component and scale on physics.scale
 */
export function gravitySystem(registry: Registry): void {
  for (const entity of registry.view([CT.Physics])) {
    const physics = registry.getComponent(entity, CT.Physics);
    const body = physics?.body;
    if (!body || body.isStatic) continue;

    Matter.Body.applyForce(body, body.position, {
      x: 0,
      y: body.mass * GRAVITY * GRAVITY_SCALE * physics.gravityScale,
    });
  }
}

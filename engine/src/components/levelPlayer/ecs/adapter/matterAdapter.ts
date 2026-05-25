import * as Comp from "../components/ComponentClasses";
import { CT } from "../core/ComponentTypes";
import type { Registry } from "../core/Registry";
import Matter from "matter-js";

/**
 * This file only contains the logic for non-game rule
 * matter adapter . e.g entity <--> body,helper for
 * get/destroy physics
 */

export function createMatterBodyForEntity(
  world: Matter.World,
  registry: Registry,
  entity: number,
): void {
  const transform = registry.getComponent(entity, CT.Transform);
  const physics = registry.getComponent(entity, CT.Physics);

  if (!transform || !physics) return;

  const bodyOptions: Matter.IChamferableBodyDefinition = {
    label: physics.label,
    friction: 0,
    frictionStatic: 0,
    isSensor: physics.isSensor,
    isStatic: physics.isStatic,
  };

  const body = physics.collisionShapes
    ? buildShapedBody(transform.x, transform.y, physics, bodyOptions)
    : Matter.Bodies.rectangle(
        transform.x,
        transform.y,
        physics.width,
        physics.height,
        bodyOptions,
      );

  applyStaticCollisionFilter(body, physics);

  if (physics.fixedRotation) {
    Matter.Body.setInertia(body, Infinity);
  }

  Matter.World.add(world, body);

  physics.body = body;
  linkPhysicsBody(registry, entity, body);
}

/**
 * build a compound body from Tiled per-tile collision shapes.
 *
 * Tiled shape coordinates are local to a `physics.width` x `physics.height`
 * box whose origin sits at the tile's top-left, y-down. the tile's center is
 * at (`centerX`, `centerY`) in world space.
 *
 * concave polygons fall back to a convex hull because poly-decomp is not
 * installed; this is intentionally an approximation.
 */
function buildShapedBody(
  centerX: number,
  centerY: number,
  physics: Comp.Physics,
  options: Matter.IChamferableBodyDefinition,
): Matter.Body {
  const tileTopLeftX = centerX - physics.width / 2;
  const tileTopLeftY = centerY - physics.height / 2;

  // Each part needs its own isSensor/isStatic — Matter's collision detector
  // checks these per-part on compound bodies, not on the parent.
  const partOptions: Matter.IChamferableBodyDefinition = { ...options };

  const parts: Matter.Body[] = (physics.collisionShapes ?? []).flatMap(
    (shape): Matter.Body[] => {
      if (shape.kind === "rectangle") {
        const cx = tileTopLeftX + shape.x + shape.width / 2;
        const cy = tileTopLeftY + shape.y + shape.height / 2;
        return [
          Matter.Bodies.rectangle(cx, cy, shape.width, shape.height, partOptions),
        ];
      }

      const worldVerts = shape.vertices.map((v) => ({
        x: tileTopLeftX + shape.x + v.x,
        y: tileTopLeftY + shape.y + v.y,
      }));
      const centroid = polygonCentroid(worldVerts);
      const part = Matter.Bodies.fromVertices(
        centroid.x,
        centroid.y,
        [worldVerts],
        partOptions,
      );
      return part ? [part] : [];
    },
  );

  if (parts.length === 0) {
    return Matter.Bodies.rectangle(
      centerX,
      centerY,
      physics.width,
      physics.height,
      options,
    );
  }

  // Single shape: skip the compound wrapper. Avoids parent/part propagation
  // pitfalls (collision filters, isSensor) entirely.
  if (parts.length === 1) return parts[0]!;

  return Matter.Body.create({ ...options, parts });
}

function polygonCentroid(verts: { x: number; y: number }[]) {
  const sum = verts.reduce(
    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / verts.length, y: sum.y / verts.length };
}

function applyStaticCollisionFilter(
  body: Matter.Body,
  physics: Comp.Physics,
): void {
  // category must be set per-part on compound bodies for Matter's broad-phase
  // to match correctly; setting only the parent is silently ignored.
  const parts = body.parts.length > 0 ? body.parts : [body];
  for (const part of parts) {
    part.collisionFilter.category = physics.category;
  }
  applyCollisionMask(
    body,
    physics.collidesWith.reduce((mask, category) => mask | category, 0),
  );
}

export function applyCollisionMask(body: Matter.Body, mask: number): void {
  const parts = body.parts.length > 0 ? body.parts : [body];
  for (const part of parts) {
    part.collisionFilter.mask = mask;
  }
}

export function getPhysicsBody(
  registry: Registry,
  entity: number,
): Matter.Body | undefined {
  const physics = registry.getComponent(entity, CT.Physics);
  return physics?.body ?? undefined;
}

export function linkPhysicsBody(
  registry: Registry,
  entity: number,
  body: Matter.Body,
): void {
  if (body) {
    registry.linkBody(entity, body);
    body.parts?.forEach((part: { id: number }) =>
      registry.linkBody(entity, part),
    );
  }
}

export function unlinkPhysicsBody(
  registry: Registry,
  body: Matter.Body | undefined,
): void {
  if (body) {
    registry.unlinkBody(body.id);
    body.parts?.forEach((part: { id: number }) => registry.unlinkBody(part.id));
  }
}

export function destroyPhysicsEntity(
  world: Matter.World,
  registry: Registry,
  entity: number,
): void {
  const body = getPhysicsBody(registry, entity);

  unlinkPhysicsBody(registry, body);
  if (body) Matter.World.remove(world, body);
  registry.destroyEntity(entity);
}

export function syncTransformsFromMatter(registry: Registry): void {
  const entities = registry.view([CT.Transform, CT.Physics]);

  for (const entity of entities) {
    const transform = registry.getComponent(
      entity,
      CT.Transform,
    );
    const physics = registry.getComponent(entity, CT.Physics);
    const body = physics?.body;

    if (!transform || !body) continue;
    // static bodies never move, and compound bodies place their position at
    // the parts' centroid, which differs from the entity's tile-center
    // transform — syncing would drag the sprite off the tile.
    if (body.isStatic) continue;

    transform.x = body.position.x;
    transform.y = body.position.y;
    transform.rotation = body.angle;
  }
}

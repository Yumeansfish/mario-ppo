import Matter from "matter-js";
import type { Registry } from "../../core/Registry";
import type { EventSink } from "../../eventQueue";
import type { Scheduler } from "../../resources/scheduler";
import type { CollisionRule } from "./collisionRules";
import {
  collisionEndRules,
  collisionStartRules,
  collisionActiveRules,
} from "./collisionRules";

export type CollisionPair = {
  bodyA: Matter.Body;
  bodyB: Matter.Body;
  collision: {
    normal: {
      x: number;
      y: number;
    };
  };
};

export type CollisionHandlerContext = {
  registry: Registry;
  world: Matter.World;
  scheduler: Scheduler;
  events: EventSink;
};

/**
 * the number is Ecs entity id
 */
export type MatchedCollision = {
  subject: number;
  target: number;
  pair: CollisionPair;
};

export type CollisionRoutingRuntime = {
  engine: Matter.Engine;
  registry: Registry;
  world: Matter.World;
  scheduler: Scheduler;
  events: EventSink;
};

export function setupCollisionRouterSystem(
  runtime: CollisionRoutingRuntime,
): void {
  const collisionContext: CollisionHandlerContext = {
    registry: runtime.registry,
    world: runtime.world,
    scheduler: runtime.scheduler,
    events: runtime.events,
  };

  Matter.Events.on(runtime.engine, "collisionStart", (event) => {
    event.pairs.forEach((pair) => {
      routeCollisionPair(collisionContext, collisionStartRules, pair);
    });
  });

  Matter.Events.on(runtime.engine, "collisionActive", (event) => {
    event.pairs.forEach((pair) => {
      routeCollisionPair(collisionContext, collisionActiveRules, pair);
    });
  });

  Matter.Events.on(runtime.engine, "collisionEnd", (event) => {
    event.pairs.forEach((pair) => {
      routeCollisionPair(collisionContext, collisionEndRules, pair);
    });
  });
}

export function routeCollisionPair(
  context: CollisionHandlerContext,
  rules: CollisionRule[],
  pair: CollisionPair,
): void {
  const registry = context.registry;
  const entityA = registry.getEntityByBodyId(pair.bodyA.id);
  const entityB = registry.getEntityByBodyId(pair.bodyB.id);

  if (entityA === undefined || entityB === undefined) return;

  for (const rule of rules) {
    const collision = matchCollisionRule(
      registry,
      rule,
      entityA,
      entityB,
      pair,
    );

    if (!collision) continue;
    rule.handler(context, collision);
  }
}

function matchCollisionRule(
  registry: Registry,
  rule: CollisionRule,
  entityA: number,
  entityB: number,
  pair: CollisionPair,
): MatchedCollision | undefined {
  const sigA = registry.getSignature(entityA);
  const sigB = registry.getSignature(entityB);

  if (sigA & rule.subject && sigB & rule.target) {
    return { subject: entityA, target: entityB, pair };
  }

  if (sigB & rule.subject && sigA & rule.target) {
    return { subject: entityB, target: entityA, pair };
  }

  return undefined;
}

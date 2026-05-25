import * as Comp from "../../../components";
import { getPhysicsBody } from "../../../adapter/matterAdapter";
import { CT } from "../../../core/ComponentTypes";
import type { Registry } from "../../../core/Registry";
import type { EventSink } from "../../../eventQueue";

export type BurstRequest = {
  x: number;
  y: number;
  texture: string;
  frame: string | number;
};

type CollisionEventContext = {
  registry: Registry;
  events: EventSink;
};

export function requestBurst(
  context: CollisionEventContext,
  request: BurstRequest,
): void {
  context.events.emit({ type: "BurstRequested", ...request });
}

export function requestBurstForEntity(
  context: CollisionEventContext,
  entity: number,
): void {
  const registry = context.registry;
  const sprite = registry.getComponent(entity, CT.Sprite);
  const body = getPhysicsBody(registry, entity);
  if (!sprite || !body) return;

  requestBurst(context, {
    x: body.position.x,
    y: body.position.y,
    texture: sprite.key,
    frame: sprite.frame,
  });
}

export function requestCoinPop(
  context: CollisionEventContext,
  x: number,
  y: number,
  coinType: string,
): void {
  context.events.emit({ type: "CoinPopRequested", x, y, coinType });
}

export function requestHorizontalWalkerReverse(
  context: CollisionEventContext,
  entity: number,
): void {
  context.events.emit({ type: "HorizontalWalkerReverseRequested", entity });
}

export function requestHorizontalFlyerReverse(
  context: CollisionEventContext,
  entity: number,
): void {
  context.events.emit({ type: "HorizontalFlyerReverseRequested", entity });
}

export function emitBoxDestroyed(
  context: CollisionEventContext,
  content?: string,
): void {
  context.events.emit(
    content !== undefined
      ? { type: "BoxDestroyed", content }
      : { type: "BoxDestroyed" },
  );
}

export function emitCoinCollected(
  context: CollisionEventContext,
  coinType: string,
  options: { animated?: boolean } = {},
): void {
  context.events.emit({ type: "CoinCollected", coinType, ...options });
}

export function emitEnemyKilled(
  context: CollisionEventContext,
  enemyType: string,
): void {
  console.log("emitted: ", enemyType);
  context.events.emit({ type: "EnemyKilled", enemyType });
}

export function emitPlayerEnteredDoor(context: CollisionEventContext): void {
  context.events.emit({ type: "PlayerEnteredDoor" });
}

export function requestPlayerBounce(
  context: CollisionEventContext,
  entity: number,
): void {
  context.events.emit({ type: "PlayerBounceRequested", entity });
}

export function requestPlayerDamageContactStart(
  context: CollisionEventContext,
  playerEntity: number,
  hazardEntity: number,
): void {
  context.events.emit({
    type: "PlayerDamageContactStarted",
    playerEntity,
    hazardEntity,
  });
}

export function requestPlayerDamageContactEnd(
  context: CollisionEventContext,
  playerEntity: number,
  hazardEntity: number,
): void {
  context.events.emit({
    type: "PlayerDamageContactEnded",
    playerEntity,
    hazardEntity,
  });
}

export function requestShellEquip(
  context: CollisionEventContext,
  playerEntity: number,
  shellEntity: number,
): void {
  context.events.emit({
    type: "ShellEquipRequested",
    playerEntity,
    shellEntity,
  });
}

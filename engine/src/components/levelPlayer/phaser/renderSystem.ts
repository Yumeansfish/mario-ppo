import * as Comp from "../ecs/components";
import { CT } from "../ecs/core/ComponentTypes";
import type { Registry } from "../ecs/core/Registry";
import {
  getGameObject,
  removeGameObject,
  setGameObject,
  type PhaserRenderContext,
} from "./phaserAdapter";
import type { TileMetadataResource } from "./tileMetadata";
import {
  DOOR_TOP_OFFSET,
  PLAYER_RENDER_SIZE,
  SMALL_PLAYER_RENDER_SIZE,
} from "./phaserConstants";

const PLAYER_DEPTH = Number.MAX_SAFE_INTEGER - 1;
const CARRIED_SHELL_DEPTH = Number.MAX_SAFE_INTEGER;

export function renderSystem(
  context: PhaserRenderContext,
  registry: Registry,
  tileMetadata?: TileMetadataResource,
): void {
  removeDeadGameObjects(context, registry);

  const entities = registry.view([CT.Transform, CT.Sprite]);

  for (const entity of entities) {
    const transform = registry.getComponent(entity, CT.Transform);
    let gameObject = getGameObject(context, entity);

    if (!gameObject) {
      gameObject = createSpriteForEntity(
        context,
        registry,
        entity,
        tileMetadata,
      );
    }
    if (!gameObject) continue;

    if (!transform) continue;
    gameObject.x = transform.x;
    gameObject.y = transform.y;
    gameObject.rotation = transform.rotation;

    if (registry.hasComponent(entity, CT.Player)) {
      renderPlayerSize(registry, entity, gameObject);
    }

    if (tileMetadata && registry.hasComponent(entity, CT.Door)) {
      renderDoor(context, registry, tileMetadata, entity, transform);
    }
  }

  applyCarrierDepth(context, registry);
}

function applyCarrierDepth(
  context: PhaserRenderContext,
  registry: Registry,
): void {
  for (const entity of registry.view([CT.Carrier])) {
    const heldEntity = registry.getComponent(
      entity,
      CT.Carrier,
    )?.heldEntity;
    if (heldEntity == null) continue;
    getGameObject(context, heldEntity)?.setDepth(CARRIED_SHELL_DEPTH);
  }
}

function removeDeadGameObjects(
  context: PhaserRenderContext,
  registry: Registry,
): void {
  for (const entity of context.gameObjects.keys()) {
    if (!registry.hasComponent(entity, CT.Sprite)) {
      removeGameObject(context, entity);
    }
  }
}

function createSpriteForEntity(
  context: PhaserRenderContext,
  registry: Registry,
  entity: number,
  tileMetadata?: TileMetadataResource,
): Phaser.GameObjects.Sprite | undefined {
  const sprite = registry.getComponent(entity, CT.Sprite);
  const transform = registry.getComponent(entity, CT.Transform);
  if (!transform || !sprite) return undefined;

  const frame = resolveSpriteFrame(sprite, tileMetadata);
  const phaserSprite = context.scene.add.sprite(
    transform.x,
    transform.y,
    sprite.key,
    frame,
  );

  if (sprite.width !== undefined && sprite.height !== undefined) {
    phaserSprite.setDisplaySize(sprite.width, sprite.height);
  }

  if (registry.hasComponent(entity, CT.Player)) {
    phaserSprite.setDepth(PLAYER_DEPTH);
  }

  setGameObject(context, entity, phaserSprite);

  return phaserSprite;
}

function resolveSpriteFrame(
  sprite: Comp.Sprite,
  tileMetadata?: TileMetadataResource,
): string | number {
  if (sprite.key !== "tiles" || !tileMetadata) return sprite.frame;
  if (!Number.isNaN(Number(sprite.frame))) return sprite.frame;

  return tileMetadata.frameByType.get(sprite.frame) ?? sprite.frame;
}

function renderPlayerSize(
  registry: Registry,
  entity: number,
  sprite: Phaser.GameObjects.Sprite,
): void {
  const player = registry.getComponent(entity, CT.Player);
  const size = player?.isSmall ? SMALL_PLAYER_RENDER_SIZE : PLAYER_RENDER_SIZE;
  sprite.setDisplaySize(size, size);
}

function renderDoor(
  context: PhaserRenderContext,
  registry: Registry,
  tileMetadata: TileMetadataResource,
  entity: number,
  transform: Comp.Transform,
): void {
  const door = registry.getComponent(entity, CT.Door);
  const bottomSprite = getGameObject(context, entity);
  if (!door || !bottomSprite) return;

  const bottomFrame = tileMetadata.frameByType.get(
    door.isOpen ? "Door_Open" : "Door_Closed",
  );
  const topFrame = tileMetadata.frameByType.get(
    door.isOpen ? "Door_Open_Top" : "Door_Closed_Top",
  );

  if (bottomFrame !== undefined) {
    bottomSprite.setFrame(bottomFrame);
  }

  if (topFrame === undefined) return;

  let topSprite = context.doorTop;
  if (!topSprite) {
    topSprite = context.scene.add.image(
      transform.x,
      transform.y - DOOR_TOP_OFFSET,
      "tiles",
    );
    context.doorTop = topSprite;
  }

  topSprite.x = transform.x;
  topSprite.y = transform.y - DOOR_TOP_OFFSET;
  topSprite.rotation = transform.rotation;
  if (topSprite.frame.name !== topFrame.toString()) {
    topSprite.setFrame(topFrame);
  }
}

import { Registry } from "../ecs/core/Registry";
import { CT } from "../ecs/core/ComponentTypes";
import * as Comp from "../ecs/components";
import { burstEffect } from "./effects";
import {
  requireTileFrameByType,
  type TileMetadataResource,
} from "./tileMetadata";
import { getGameObject, type PhaserRenderContext } from "./phaserAdapter";
import type { GameEvent } from "../ecs/eventQueue";
import {
  COIN_POP_DURATION,
  COIN_POP_HEIGHT,
  COIN_POP_SIZE,
  DAMAGE_SHAKE_DURATION,
  DAMAGE_SHAKE_INTENSITY,
} from "./phaserConstants";

/**
 * Updates animations and sprite mirroring using the Animator component.
 */
export function animationSystem(
  context: PhaserRenderContext,
  registry: Registry,
) {
  const entities = registry.view([CT.Animator, CT.Sprite]);

  for (const entity of entities) {
    const animator = registry.getComponent(entity, CT.Animator);
    const gameObject: Phaser.GameObjects.Sprite | undefined = getGameObject(
      context,
      entity,
    );
    if (!animator || !gameObject) continue;

    if (animator.currentAnim && gameObject.anims) {
      if (gameObject.anims.currentAnim?.key !== animator.currentAnim) {
        if (!context.scene.anims.exists(animator.currentAnim)) continue;
        gameObject.anims.play(animator.currentAnim, true);
      }
    }

    gameObject.flipX = animator.flipX;
  }
}

export function animationEventSystem(
  context: PhaserRenderContext,
  tileMetadata: TileMetadataResource,
  events: GameEvent[],
  options: { onCoinPopComplete?: ((coinType: string) => void) | undefined } = {},
): void {
  for (const event of events) {
    if (event.type === "CoinPopRequested") {
      playCoinPopAnimation(
        context.scene,
        tileMetadata,
        event.x,
        event.y,
        event.coinType,
        options.onCoinPopComplete,
      );
    } else if (event.type === "BurstRequested") {
      burstEffect(context.scene, event.x, event.y, event.texture, event.frame);
    } else if (event.type === "PlayerTookDamage") {
      const sprite = getGameObject(context, event.entity);
      if (sprite) {
        context.scene.cameras.main.shake(
          DAMAGE_SHAKE_DURATION,
          DAMAGE_SHAKE_INTENSITY,
        );
        context.scene.tweens.add({
          targets: sprite,
          alpha: { from: 0.3, to: 1 },
          duration: 100,
          repeat: 10,
          onComplete: () => {
            sprite.alpha = 1;
          },
        });
      }
    }
  }
}

function playCoinPopAnimation(
  scene: Phaser.Scene,
  tileMetadata: TileMetadataResource,
  x: number,
  y: number,
  coinType: string,
  onCompleteExec?: (coinType: string) => void,
): void {
  const frame = requireTileFrameByType(tileMetadata, coinType);
  const coinSprite = scene.add.sprite(x, y, "tiles", frame);
  coinSprite.setDisplaySize(COIN_POP_SIZE, COIN_POP_SIZE);

  const animKey = `coin_spin_${coinType.replace("Item_Coin_", "").toLowerCase()}`;
  if (scene.anims.exists(animKey)) coinSprite.play(animKey);

  scene.tweens.add({
    targets: coinSprite,
    y: y - COIN_POP_HEIGHT,
    alpha: { from: 1, to: 0 },
    duration: COIN_POP_DURATION,
    ease: "Quad.easeOut",
    onComplete: () => {
      coinSprite.destroy();
      onCompleteExec?.(coinType);
    },
  });
}

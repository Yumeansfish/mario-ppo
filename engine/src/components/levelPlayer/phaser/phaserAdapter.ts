export type PhaserRenderContext = {
  scene: Phaser.Scene;
  gameObjects: Map<number, Phaser.GameObjects.Sprite>;
  doorTop?: Phaser.GameObjects.Image;
};

export function createPhaserRenderContext(
  scene: Phaser.Scene,
): PhaserRenderContext {
  return {
    scene,
    gameObjects: new Map(),
  };
}

export function getGameObject(
  context: PhaserRenderContext,
  entity: number,
): Phaser.GameObjects.Sprite | undefined {
  return context.gameObjects.get(entity);
}

export function setGameObject(
  context: PhaserRenderContext,
  entity: number,
  gameObject: Phaser.GameObjects.Sprite,
): void {
  context.gameObjects.set(entity, gameObject);
}

export function removeGameObject(
  context: PhaserRenderContext,
  entity: number,
): void {
  context.gameObjects.get(entity)?.destroy();
  context.gameObjects.delete(entity);
}

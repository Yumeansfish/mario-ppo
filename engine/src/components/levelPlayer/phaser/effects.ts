/**
 * Spawn a fire-and-forget particle burst at (x, y).
 *
 * The emitter auto-destroys after `duration` ms / `stopAfter` particles —
 * no manual cleanup needed by the caller.
 *
 */
export function burstEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
  texture: string,
  frame: string | number,
): void {
  scene.add.particles(x, y, texture, {
    frame,
    quantity: 8,
    speed: { min: 80, max: 220 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.4, end: 0 },
    alpha: { start: 1, end: 0 },
    gravityY: 400,
    lifespan: 500,
    duration: 50,
    stopAfter: 8,
  });
}

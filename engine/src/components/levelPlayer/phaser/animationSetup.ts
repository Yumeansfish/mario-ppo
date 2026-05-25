import Phaser from "phaser";


/**
 * Creates animations at the start of a scene.
 */
export function setupGlobalAnimations(
  scene: Phaser.Scene,
  groundTileset: Phaser.Tilemaps.Tileset,
) {
  // Player Animations
  if (!scene.anims.exists("walk")) {
    scene.anims.create({
      key: "walk",
      frames: scene.anims.generateFrameNames("player", {
        prefix: "p1_walk",
        start: 1,
        end: 11,
        zeroPad: 2,
      }),
      frameRate: 15,
      repeat: -1,
    });
  }

  if (!scene.anims.exists("idle")) {
    scene.anims.create({
      key: "idle",
      frames: [{ key: "player", frame: "p1_stand" }],
      frameRate: 10,
    });
  }

  // Flag Animation
  if (!scene.anims.exists("flag_spin")) {
    const flagA = Object.entries(groundTileset.tileData).find(
      ([, data]) => data.type === "Start_Flag",
    );
    const flagB = Object.entries(groundTileset.tileData).find(
      ([, data]) => data.type === "Start_Flag_B",
    );

    if (flagA && flagB) {
      scene.anims.create({
        key: "flag_spin",
        frames: [
          { key: "tiles", frame: parseInt(flagA[0]) },
          { key: "tiles", frame: parseInt(flagB[0]) },
        ],
        frameRate: 4,
        repeat: -1,
      });
    } else {
    }
  }

  // Slime Animations
  if (!scene.anims.exists("slime_walk")) {
    scene.anims.create({
      key: "slime_walk",
      frames: [
        { key: "slime_normal", frame: "slime_normal_walk_a" },
        { key: "slime_normal", frame: "slime_normal_walk_b" },
      ],
      frameRate: 4,
      repeat: -1,
    });
  }

  // Snail Animations
  if (!scene.anims.exists("snail_walk")) {
    scene.anims.create({
      key: "snail_walk",
      frames: [
        { key: "snail", frame: "snail_walk_a" },
        { key: "snail", frame: "snail_walk_b" },
      ],
      frameRate: 4,
      repeat: -1,
    });
  }

  if (!scene.anims.exists("bee_fly")) {
    scene.anims.create({
      key: "bee_fly",
      frames: [{ key: "bee_a" }, { key: "bee_b" }],
      frameRate: 6,
      repeat: -1,
      yoyo: true,
    });
  }

  createCoinAnimation(scene, groundTileset, "Item_Coin_Gold", "coin_spin_gold");
  createCoinAnimation(
    scene,
    groundTileset,
    "Item_Coin_Silver",
    "coin_spin_silver",
  );
  createCoinAnimation(
    scene,
    groundTileset,
    "Item_Coin_Bronze",
    "coin_spin_bronze",
  );
}

function createCoinAnimation(
  scene: Phaser.Scene,
  groundTileset: Phaser.Tilemaps.Tileset,
  coinType: string,
  animKey: string,
): void {
  if (scene.anims.exists(animKey)) return;

  const frontFrame = findTilesetFrameByType(groundTileset, coinType);
  if (frontFrame === undefined) return;

  const sideFrame = findTilesetFrameByType(groundTileset, `${coinType}_Side`);
  const frames = [{ key: "tiles", frame: frontFrame }];

  if (sideFrame !== undefined) {
    frames.push({ key: "tiles", frame: sideFrame });
  }

  scene.anims.create({
    key: animKey,
    frames,
    frameRate: 4,
    repeat: -1,
    yoyo: true,
  });
}

function findTilesetFrameByType(
  groundTileset: Phaser.Tilemaps.Tileset,
  type: string,
): number | undefined {
  for (const [frame, data] of Object.entries(groundTileset.tileData ?? {})) {
    if (data.type === type) return Number.parseInt(frame, 10);
  }
  return undefined;
}

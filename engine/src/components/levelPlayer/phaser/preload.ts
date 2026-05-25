import { TiledMapJson } from "../ecs/headlessRuntime/types";
import { TILE_SIZE } from "./phaserConstants";

export function preloadLevelAssets(scene: Phaser.Scene, mapJson: TiledMapJson) {
  scene.load.tilemapTiledJSON("map", mapJson);
  scene.load.image(
    "bg_layer1",
    "/assets/background/overworld/background_solid_sky.png",
  );
  scene.load.image(
    "bg_layer2",
    "/assets/background/overworld/background_clouds.png",
  );
  scene.load.image(
    "bg_layer3",
    "/assets/background/overworld/background_fade_trees.png",
  );
  scene.load.image(
    "bg_layer4",
    "/assets/background/overworld/background_solid_sky.png",
  );

  scene.load.spritesheet("tiles", "/assets/tiles.png", {
    frameWidth: TILE_SIZE,
    frameHeight: TILE_SIZE,
  });
  scene.load.image("coin_gold", "/assets/coin/coin_gold.png");
  scene.load.image("coin_gold_side", "/assets/coin/coin_gold_side.png");
  scene.load.image("saw_a", "/assets/enemies/saw/saw_a.png");
  scene.load.image("saw_b", "/assets/enemies/saw/saw_b.png");
  scene.load.atlas(
    "slime_normal",
    "/assets/enemies/slime_normal.png",
    "/assets/enemies/slime_normal.json",
  );
  scene.load.atlas(
    "snail",
    "/assets/enemies/snail.png",
    "/assets/enemies/snail.json",
  );
  scene.load.image("bee_a", "/assets/enemies/bee/bee_a.png");
  scene.load.image("bee_b", "/assets/enemies/bee/bee_b.png");
  scene.load.image("bee_rest", "/assets/enemies/bee/bee_rest.png");
  scene.load.atlas("player", "/assets/player.png", "/assets/player.json");
}

import Matter from "matter-js";
import { createBackground } from "./background.js";
import { setupGlobalAnimations } from "./animationSetup.js";
import { createHeadlessLevelRuntime } from "../ecs/headlessRuntime/create.js";
import { InputRecorder } from "../ecs/inputRecorder.js";
import { createPhaserRenderContext, getGameObject } from "./phaserAdapter.js";
import { CT } from "../ecs/core/ComponentTypes.js";
import { createTileMetadataResource } from "./tileMetadata.js";
import { renderSystem } from "./renderSystem.js";
import type {
  PhaserLevelCallbacks,
  PhaserLevelRuntime,
} from "./updatePhaserLevel.js";
import type { Registry } from "../ecs/core/Registry.js";
import type { PhaserRenderContext } from "./phaserAdapter.js";
import type { TileMetadataResource } from "./tileMetadata.js";
import type { LevelData } from "../ecs/headlessRuntime/types.js";
import {
  LEVEL_COMPLETE_CALLBACK_DELAY,
  LEVEL_COMPLETE_FADE_DURATION,
  LEVEL_COMPLETE_FLASH_DURATION,
  LEVEL_COMPLETE_SLIDE_DURATION,
} from "./phaserConstants.js";

const LEVEL_CAMERA_ZOOM_OUT = 0.9;

type RuntimeOptions = {
  callbacks?: PhaserLevelCallbacks;
  levelData: LevelData;
};

type PhaserDisplayRuntime = {
  mapSize: { width: number; height: number };
  playerEntity: number;
  registry: Registry;
  renderContext: PhaserRenderContext;
  tileMetadata: TileMetadataResource;
};

// PhaserRuntime means Runtime + Phaser rendering and input.
// Phaser reads the map, then wraps the Runtime with sprites, camera, and keys.
export function createPhaserLevelRuntime(
  scene: Phaser.Scene,
  options: RuntimeOptions,
) {
  const phaserLevel = createPhaserLevelData(scene);
  const headlessRuntime = createHeadlessLevelRuntime(options.levelData);
  const renderContext = createPhaserRenderContext(scene);
  const cursors = scene.input.keyboard!.createCursorKeys();
  const throwKey = scene.input.keyboard!.addKey("Z");
  setupGlobalAnimations(scene, phaserLevel.groundTileset!);
  const player = setupPhaserDisplay(scene, {
    mapSize: headlessRuntime.mapSize,
    playerEntity: headlessRuntime.playerEntity,
    registry: headlessRuntime.registry,
    renderContext,
    tileMetadata: phaserLevel.tileMetadata,
  });

  const runtime = {
    ...headlessRuntime,
    renderContext,
    map: phaserLevel.map,
    worldLayer: phaserLevel.worldLayer,
    groundTileset: phaserLevel.groundTileset,
    tileMetadata: phaserLevel.tileMetadata,
    state: createPhaserRuntimeState(),
    callbacks: options.callbacks ?? {},
    player,
    cursors,
    throwKey,
    inputRecorder: new InputRecorder(),
    completeLevel: () => completeLevel(scene, runtime),
  };

  runtime.callbacks.onRunStarted?.();
  runtime.callbacks.onSceneReady?.(scene);
  return runtime;
}

function createPhaserLevelData(scene: Phaser.Scene) {
  const map = scene.make.tilemap({ key: "map" });
  const groundTiles = map.addTilesetImage("tiles")!;
  const worldLayer = map.createLayer("World", groundTiles, 0, 0)!;
  const groundTileset = map.getTileset("tiles")!;
  const tileMetadata = createTileMetadataResource(groundTileset);
  worldLayer.setCollisionByExclusion([-1]);

  return {
    map,
    worldLayer,
    groundTileset,
    tileMetadata,
  };
}

function createPhaserRuntimeState() {
    return {
        isDying: false,
        isLevelComplete: false,
        forcedFlyY: null,
        sineFly: null,
        doorStartPositions: new Map(),
        fixedDtAccumulator: 0,
    };
}

function setupPhaserDisplay(
  scene: Phaser.Scene,
  runtime: PhaserDisplayRuntime,
) {
  createBackground(scene, runtime.mapSize);
  // first load for game objects
  renderSystem(runtime.renderContext, runtime.registry, runtime.tileMetadata);

  const player = getGameObject(runtime.renderContext, runtime.playerEntity);

  scene.cameras.main.setBounds(
    0,
    0,
    runtime.mapSize.width,
    runtime.mapSize.height,
  );
  scene.cameras.main.setZoom(
    (scene.cameras.main.height / runtime.mapSize.height) *
      LEVEL_CAMERA_ZOOM_OUT,
  );
  if (player) {
    scene.cameras.main.startFollow(player);
  }

  return player;
}

function completeLevel(scene: Phaser.Scene, runtime: PhaserLevelRuntime) {
  if (runtime.state.isLevelComplete) return;
  runtime.state.isLevelComplete = true;

  freezePlayerBody(runtime);

  const doorId = runtime.registry.view([CT.Door])[0]!;
  const doorPosition = runtime.registry.getComponent(doorId, CT.Transform);
  if (!runtime.player || !doorPosition) return;

  const inputLog = runtime.inputRecorder.getLog();
  const totalFrames = runtime.inputRecorder.frame;

  scene.tweens.add({
    targets: runtime.player,
    x: doorPosition.x,
    duration: LEVEL_COMPLETE_SLIDE_DURATION,
    ease: "Quad.easeInOut",
    onComplete: () => {
      scene.tweens.add({
        targets: runtime.player,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: LEVEL_COMPLETE_FADE_DURATION,
        ease: "Quad.easeIn",
        onComplete: () => {
          scene.cameras.main.flash(
            LEVEL_COMPLETE_FLASH_DURATION,
            255,
            255,
            255,
          );
          scene.time.delayedCall(LEVEL_COMPLETE_CALLBACK_DELAY, () => {
            runtime.callbacks.onLevelCompleted?.({ inputLog, totalFrames });
          });
        },
      });
    },
  });
}

function freezePlayerBody(runtime: PhaserLevelRuntime) {
  const body = getPlayerBody(runtime);
  if (!body) return;

  Matter.Body.setStatic(body, true);
  Matter.Body.setVelocity(body, { x: 0, y: 0 });

  const filter = runtime.registry.getComponent(
    runtime.playerEntity,
    CT.PlayerCollisionFilter,
  );
  if (!filter) return;

  filter.normalMask = 0;
  filter.risingMask = 0;
  filter.disabledMask = 0;
}


function getPlayerBody(runtime: PhaserLevelRuntime) {
  return runtime.registry.getComponent(runtime.playerEntity, CT.Physics)?.body;
}

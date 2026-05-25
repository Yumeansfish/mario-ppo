import Matter from "matter-js";
import { spawnEntity, spawnHeadlessEntity } from "../entities/spawnEntity.js";
import {
  CATEGORY_DEFAULT,
  CATEGORY_ENEMY,
  CATEGORY_SEMISOLID,
} from "../resources/physicsConfig.js";
import {
  applyCollisionMask,
  createMatterBodyForEntity,
} from "../adapter/matterAdapter.js";
import { CT } from "../core/ComponentTypes.js";
import { Registry } from "../core/Registry.js";
import { EventQueue } from "../eventQueue.js";
import { createLevelStateResourceFromMapProperties } from "../resources/levelState.js";
import { Scheduler } from "../resources/scheduler.js";
import { levelStateSystem } from "../systems/lifecycle/levelStateSystem.js";
import { setupCollisionRouterSystem } from "../systems/collision/collisionRouterSystem.js";
import { LevelRuntime } from "./update.js";
import { LevelData, MapSize, ObjectTile, WorldTile } from "./types.js";

const DEFAULT_SPAWN = { x: 200, y: 200 };

// Runtime means ECS + Matter
export function createHeadlessLevelRuntime(levelData : LevelData) {
  const registry = new Registry();
  const events = new EventQueue();
  const scheduler = new Scheduler();
  /** manage gravity in {@link gravitySystem.ts} */
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 0 },
  });
  const world = engine.world;
  const levelState = createLevelStateResourceFromMapProperties(
    levelData.properties,
  );

  createTileMatterBodies(world, levelData.worldTiles);
  createWorldBounds(world, levelData.mapSize);

  const runtime : LevelRuntime = {
    registry,
    events,
    scheduler,
    engine,
    world,
    mapSize: levelData.mapSize,
    levelState,
    playerEntity: 0,
  };

  spawnLevelEntities(runtime, levelData.objectTiles);
  levelStateSystem(registry, levelState, []);

  spawnRuntimePlayer(runtime);
  setupCollisionRouterSystem(runtime);

  return runtime;
}

function createTileMatterBodies(world : Matter.World, worldTiles : WorldTile[]){
  worldTiles.forEach((tile) => {
    const body = Matter.Bodies.rectangle(
      tile.x,
      tile.y,
      tile.width,
      tile.height,
      {
        isStatic: true,
        label: tile.label,
      },
    );

    applyTileCollisionFilter(body, tile.label);
    Matter.World.add(world, body);
  });
}

/**
 * assign collision category for tiles.
 */
function applyTileCollisionFilter(body : Matter.Body, label : string) {
  body.collisionFilter.category =
    label === "Semisolid" ? CATEGORY_SEMISOLID : CATEGORY_DEFAULT;
  applyCollisionMask(body, 0xffff);
}

function createWorldBounds(world : Matter.World, mapSize : MapSize) {
  const wallThickness = 64;
  const wallHeight = mapSize.height + 200;
  const wallWidth = mapSize.width + wallThickness * 2;
  const topWall = Matter.Bodies.rectangle(
    mapSize.width / 2,
    -wallThickness / 2,
    wallWidth,
    wallThickness,
    {
      isStatic: true,
      label: "world-top",
    },
  );
  const leftWall = Matter.Bodies.rectangle(
    -wallThickness / 2,
    wallHeight / 2,
    wallThickness,
    wallHeight,
    {
      isStatic: true,
      label: "world-left",
    },
  );
  const rightWall = Matter.Bodies.rectangle(
    mapSize.width + wallThickness / 2,
    wallHeight / 2,
    wallThickness,
    wallHeight,
    {
      isStatic: true,
      label: "world-right",
    },
  );

  topWall.collisionFilter.category = CATEGORY_DEFAULT;
  topWall.collisionFilter.mask = 0xffff;
  leftWall.collisionFilter.category = CATEGORY_DEFAULT;
  leftWall.collisionFilter.mask = 0xffff & ~CATEGORY_ENEMY;
  rightWall.collisionFilter.category = CATEGORY_DEFAULT;
  rightWall.collisionFilter.mask = 0xffff;

  Matter.World.add(world, [topWall, leftWall, rightWall]);
}

function spawnLevelEntities(runtime : LevelRuntime, objectTiles : ObjectTile[]) {
  objectTiles.forEach((entityData) => {
    spawnHeadlessEntity(
      runtime.registry,
      runtime.world,
      entityData.type,
      entityData.x,
      entityData.y,
      entityData.frame,
      entityData.content,
      {
        configure: (entity) => {
          if (entityData.type !== "Damage") return;

          const physics = runtime.registry.getComponent(entity, CT.Physics);
          if (physics) {
            physics.width = entityData.width;
            physics.height = entityData.height;
            physics.collisionShapes = entityData.collisionShapes;
          }

          const sprite = runtime.registry.getComponent(entity, CT.Sprite);
          if (sprite) {
            sprite.width = entityData.width;
            sprite.height = entityData.height;
          }
        },
      },
    );
  });
}

function spawnRuntimePlayer(runtime : LevelRuntime) {
  const spawn = findPlayerSpawn(runtime);
  runtime.playerEntity = spawnEntity(
    runtime.registry,
    "Player",
    spawn.x,
    spawn.y,
  );
  if (runtime.playerEntity === -1) {
    throw new Error("Failed to spawn player entity");
  }

  createMatterBodyForEntity(
    runtime.world,
    runtime.registry,
    runtime.playerEntity,
  );
}

function findPlayerSpawn(runtime : LevelRuntime) {
  const startFlags = runtime.registry.view([CT.StartFlag, CT.Transform]);
  const startFlag = startFlags[0];
  if (startFlag === undefined) return DEFAULT_SPAWN;

  const transform = runtime.registry.getComponent(startFlag, CT.Transform);
  return transform ?? DEFAULT_SPAWN;
}

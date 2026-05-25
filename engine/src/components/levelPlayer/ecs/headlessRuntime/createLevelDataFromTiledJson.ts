import type {
  CollisionShape,
  LevelData,
  ObjectTile,
  TiledMapJson,
  TiledObjectLayer,
  TiledWorldLayer,
  Tileset,
  TilesetTile,
  WorldTile,
} from "./types";

export function createLevelDataFromTiledJson(mapJson: TiledMapJson): LevelData {
  const tileset = mapJson.tilesets[0];
  if (!tileset) throw new Error("no tileset");

  // Tiles whose tileset type is "Damage" are spawned as Hazard entities
  // (with per-tile collision shapes), not static world tiles, so they go
  // through the Damage blueprint instead of becoming a solid 128x128 block.
  const world = createWorldLayer(getWorldLayer(mapJson), mapJson, tileset);

  return {
    mapSize: {
      width: mapJson.width * mapJson.tilewidth,
      height: mapJson.height * mapJson.tileheight,
    },
    properties: mapJson.properties,
    worldTiles: world.worldTiles,
    objectTiles: [...createObjectLayer(mapJson, tileset), ...world.hazardTiles],
  };
}

function getWorldLayer(mapJson: TiledMapJson): TiledWorldLayer {
  const layer = mapJson.layers.find(
    (layer): layer is TiledWorldLayer =>
      layer.name === "World" && layer.type === "tilelayer",
  );

  if (!layer) throw new Error("no world tile layer");
  return layer;
}

function createWorldLayer(
  layer: TiledWorldLayer,
  mapJson: TiledMapJson,
  tileset: Tileset,
): { worldTiles: WorldTile[]; hazardTiles: ObjectTile[] } {
  const worldTiles: WorldTile[] = [];
  const hazardTiles: ObjectTile[] = [];

  layer.data.forEach((gid, index) => {
    if (gid === 0) return;
    const tile = getTilesetTile(gid, tileset);
    const tileX = index % layer.width;
    const tileY = Math.floor(index / layer.width);
    const cx = tileX * mapJson.tilewidth + mapJson.tilewidth / 2;
    const cy = tileY * mapJson.tileheight + mapJson.tileheight / 2;

    if (tile?.type === "Damage") {
      hazardTiles.push(
        buildObjectTile(
          "Damage",
          cx,
          cy,
          mapJson.tilewidth,
          mapJson.tileheight,
          gid,
          tileset,
          tile,
        ),
      );
      return;
    }

    worldTiles.push({
      x: cx,
      y: cy,
      width: mapJson.tilewidth,
      height: mapJson.tileheight,
      label: tile?.type || "tile",
    });
  });

  return { worldTiles, hazardTiles };
}

function createObjectLayer(
  mapJson: TiledMapJson,
  tileset: Tileset,
): ObjectTile[] {
  return mapJson.layers
    .filter((layer): layer is TiledObjectLayer => layer.type === "objectgroup")
    .flatMap((layer) => layer.objects)
    .flatMap((object) => {
      const tile = getTilesetTile(object.gid, tileset);
      const type = tile?.type || object.type;
      if (!type) return [];

      const objectTile = buildObjectTile(
        type,
        object.x + object.width / 2,
        object.y - object.height / 2,
        object.width,
        object.height,
        object.gid,
        tileset,
        tile,
      );
      const content = object.properties?.find(
        (property) => property.name === "Content",
      )?.value;

      return content === undefined ? objectTile : { ...objectTile, content };
    });
}

function buildObjectTile(
  type: string,
  cx: number,
  cy: number,
  width: number,
  height: number,
  gid: number,
  tileset: Tileset,
  tile: TilesetTile | undefined,
): ObjectTile {
  const objectTile: ObjectTile = {
    type,
    x: cx,
    y: cy,
    width,
    height,
    frame: gid - tileset.firstgid,
  };
  const shapes = extractCollisionShapes(tile);
  if (shapes.length > 0) objectTile.collisionShapes = shapes;
  return objectTile;
}

function extractCollisionShapes(
  tile: TilesetTile | undefined,
): CollisionShape[] {
  const objects = tile?.objectgroup?.objects;
  if (!objects) return [];
  return objects.flatMap((shape): CollisionShape[] => {
    if (shape.polygon) {
      return [{ kind: "polygon", x: shape.x, y: shape.y, vertices: shape.polygon }];
    }
    if (shape.width > 0 && shape.height > 0) {
      return [
        {
          kind: "rectangle",
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
        },
      ];
    }
    return [];
  });
}

function getTilesetTile(
  gid: number,
  tileset: Tileset,
): TilesetTile | undefined {
  return tileset.tiles.find((tile) => tile.id === gid - tileset.firstgid);
}

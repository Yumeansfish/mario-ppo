export type TileMetadataResource = {
  frameByType: ReadonlyMap<string, number>;
  dataByFrame: ReadonlyMap<number, any>;
};

export function createTileMetadataResource(
  groundTileset: any,
): TileMetadataResource {
  const frameByType = new Map<string, number>();
  const dataByFrame = new Map<number, any>();

  for (const [frameRaw, data] of Object.entries(
    groundTileset?.tileData ?? {},
  )) {
    const frame = Number.parseInt(frameRaw, 10);
    if (Number.isNaN(frame)) continue;

    dataByFrame.set(frame, data);

    const type = (data as { type?: string }).type;
    if (type) frameByType.set(type, frame);
  }

  return { frameByType, dataByFrame };
}

export function getTileFrameByType(
  tileMetadata: TileMetadataResource,
  type: string,
): number | undefined {
  return tileMetadata.frameByType.get(type);
}

export function requireTileFrameByType(
  tileMetadata: TileMetadataResource,
  type: string,
): number {
  const frame = getTileFrameByType(tileMetadata, type);

  if (frame === undefined) {
    throw new Error(`Missing tileset frame for type: ${type}`);
  }

  return frame;
}

export function getTileDataByFrame(
  tileMetadata: TileMetadataResource,
  frame: number,
): any | undefined {
  return tileMetadata.dataByFrame.get(frame);
}

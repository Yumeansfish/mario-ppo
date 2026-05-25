export function createBgRow(scene : Phaser.Scene, y : number, key : string, depth : number, mapWidth : number, sliceH : number) {
  const img = scene.textures.get(key).getSourceImage();
  const scale = sliceH / img.height;
  const scaledW = img.width * scale;

  for (let x = 0; x < mapWidth; x += scaledW) {
    const bg = scene.add.image(x, y, key).setOrigin(0, 0);
    bg.setDisplaySize(scaledW, sliceH + 1);
    bg.setDepth(depth);
    bg.setScrollFactor(1);
  }
}

export function createBackground(scene : Phaser.Scene, mapSize : { width: number, height: number, }) {
    const sliceHeight = mapSize.height / 4;

    createBgRow(scene, 0, "bg_layer1", -4, mapSize.width, sliceHeight);
    createBgRow(scene, sliceHeight, "bg_layer2", -3, mapSize.width, sliceHeight);
    createBgRow(
        scene,
        sliceHeight * 2,
        "bg_layer3",
        -2,
        mapSize.width,
        sliceHeight,
    );
    createBgRow(
        scene,
        sliceHeight * 3,
        "bg_layer4",
        -1,
        mapSize.width,
        sliceHeight,
    );
}

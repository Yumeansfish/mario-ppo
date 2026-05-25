import * as CC from "../components/ComponentClasses";
import {
  CATEGORY_DEFAULT,
  CATEGORY_SEMISOLID,
  CATEGORY_ENEMY,
  CATEGORY_DOOR,
  CATEGORY_COIN,
} from "../resources/physicsConfig";

const mask = (...categories: number[]): number =>
  categories.reduce((result, category) => result | category, 0);

const coinBlueprint =
  (coinType: string, animKey: string) => (x: number, y: number) => [
    new CC.Transform(x, y),
    new CC.Coin(coinType),
    new CC.Physics(
      128 * 0.6,
      128 * 0.6,
      "coin",
      CATEGORY_COIN,
      [CATEGORY_DEFAULT],
      true,
      true,
    ),
    new CC.Sprite("tiles", "0", 128 * 0.8, 128 * 0.8),
    new CC.Animator(animKey),
  ];

export const BLUEPRINTS: Record<
  string,
  (x: number, y: number) => CC.Component[]
> = {
  Enemy_Slime_Normal: (x, y) => [
    new CC.Transform(x, y),
    new CC.Slime(),
    new CC.HorizontalWalker(4, -1, true, false),
    new CC.Hazard(1, true, false, true),
    new CC.Enemy(),
    new CC.OutOfBounds("Enemy_Slime_Normal"),
    new CC.Physics(
      128 * 0.64,
      128 * 0.64,
      "enemy",
      CATEGORY_ENEMY,
      [CATEGORY_DEFAULT, CATEGORY_SEMISOLID, CATEGORY_ENEMY],
      false,
      false,
      true,
    ),
    new CC.Sprite("slime_normal", "slime_normal_walk_a", 102, 102),
    new CC.Animator("slime_walk"),
  ],
  Enemy_Snail: (x, y) => [
    new CC.Transform(x, y),
    new CC.HorizontalWalker(2.5, -1, true, true),
    new CC.Hazard(1, true, false, true),
    new CC.Enemy(),
    new CC.OutOfBounds("Enemy_Snail"),
    new CC.Physics(128 * 0.64, 128 * 0.64, "enemy", CATEGORY_ENEMY, [
      CATEGORY_DEFAULT,
      CATEGORY_SEMISOLID,
      CATEGORY_ENEMY,
    ]),
    new CC.Snail(),
    new CC.Sprite("snail", "snail_walk_a", 102, 102),
    new CC.Animator("snail_walk"),
  ],
  Enemy_Bee: (x, y) => [
    new CC.Transform(x, y),
    new CC.Bee(),
    new CC.HorizontalFlyer(2, -1, true),
    new CC.Hazard(1, true, false, true),
    new CC.Enemy(),
    new CC.OutOfBounds("Enemy_Bee"),
    new CC.Physics(
      128 * 0.64,
      128 * 0.64,
      "enemy",
      CATEGORY_ENEMY,
      [CATEGORY_DEFAULT, CATEGORY_SEMISOLID, CATEGORY_ENEMY],
      false,
      false,
      true,
      // disable gravity
      0,
    ),
    new CC.Sprite("bee_a", "0", 102, 102),
    new CC.Animator("bee_fly"),
  ],
  Decoration: (x: number, y: number) => [
    new CC.Sprite("tiles", "0"),
    new CC.Transform(x, y),
  ],
  Damage: (x, y) => [
    new CC.Transform(x, y),
    new CC.Hazard(1, true, true, true),
    new CC.PassiveHazard(),
    // sensor: player walks into the hazard and dies instead of standing on it.
    new CC.Physics(128, 128, "Damage", CATEGORY_DEFAULT, [0xffff], true, true),
    new CC.Sprite("tiles", "0"),
  ],
  Player: (x, y) => [
    new CC.Transform(x, y),
    new CC.PlayerControl(),
    new CC.Physics(128 * 0.55, 128 - 8, "player", CATEGORY_DEFAULT, [0xffff]),
    new CC.Carrier(),
    new CC.Sprite("player", "p1_stand", 128, 128),
    new CC.Animator("idle"),
    new CC.PlayerCollisionFilter(
      mask(
        CATEGORY_DEFAULT,
        CATEGORY_ENEMY,
        CATEGORY_COIN,
        CATEGORY_DOOR,
      ),
      mask(CATEGORY_DEFAULT, CATEGORY_ENEMY, CATEGORY_COIN, CATEGORY_DOOR),
      0,
    ),
  ],
  Start_Flag: (x: number, y: number) => [
    new CC.Transform(x, y),
    new CC.StartFlag(),
    new CC.Sprite("tiles", "0"),
    new CC.Animator("flag_spin"),
  ],
  Door_Closed: (x, y) => [
    new CC.Transform(x, y),
    new CC.Physics(
      128,
      256,
      "door",
      CATEGORY_DOOR,
      [CATEGORY_DEFAULT],
      true,
      true,
      true,
    ),
    new CC.Sprite("tiles", "0"),
    new CC.Door(),
  ],
  Box: (x, y) => [
    new CC.Transform(x, y),
    new CC.Sprite("tiles", "0"),
    new CC.Physics(128, 128, "Box", CATEGORY_DEFAULT, [0xffff], true, false),
    new CC.DestructibleBox(),
  ],
  BoxDouble: (x, y) => [
    new CC.Transform(x, y),
    new CC.Physics(128, 128, "BoxDouble", CATEGORY_DEFAULT, [0xffff], true, false),
    new CC.Sprite("tiles", "0"),
    new CC.DestructibleBox(),
  ],
  /*
   * this blueprint can be only used in runtime.
   * editor cannot place shell directly on the original map
   * it can be only spawned when snail go back to shell
   */
  Item_Shell: (x, y) => [
    new CC.Transform(x, y),
    new CC.Shell(),
    new CC.HorizontalWalker(15, 0, false, false),
    new CC.Hazard(1, true, true, false),
    new CC.OutOfBounds("Enemy_Snail"),
    new CC.Physics(
      128 * 0.9,
      (128 * 0.9) / 2,
      "shell",
      CATEGORY_DEFAULT,
      [0xffff],
    ),
    new CC.Sprite("tiles", "Item_Shell", 128 * 0.9, 128 * 0.9),
  ],
  Item_Coin_Gold: coinBlueprint("Item_Coin_Gold", "coin_spin_gold"),
  Item_Coin_Silver: coinBlueprint("Item_Coin_Silver", "coin_spin_silver"),
  Item_Coin_Bronze: coinBlueprint("Item_Coin_Bronze", "coin_spin_bronze"),
};

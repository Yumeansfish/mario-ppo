/**
 * Component type bit flags
 *
 * values used as bitmasks in entity signatures
 * - add: signature | CT.Transform
 * - remove: signature & ~CT.Transform
 * - has: (signature & CT.Transform) === CT.Transform
 *
 */
export const CT = {
  /*
   * position
   */
  Transform: 1,

  /**
   * render
   */
  Sprite: 2,

  /**
   * physics body config + runtime Matter body reference
   */
  Physics: 4,

  /**
   * player-only control + state
   */
  Player: 8,

  /**
   * abstract horizontal movement behavior
   */
  HorizontalWalker: 16,

  /**
   * door state (open or not)
   */
  Door: 32,

  /**
   *  tag component for dying entities / out of world
   */
  OutOfBounds: 64,

  /**
   * dynamic collision filter
   */
  PlayerCollisionFilter: 128,

  /**
   * abstract damage component
   */
  Hazard: 256,

  StartFlag: 512,

  /**
   * animation state
   */
  Animator: 1024,

  /**
   * tag component
   */
  Slime: 2048,

  /**
   * tag
   */
  Shell: 4096,

  /**
   * tag
   */
  Snail: 8192,

  /**
   * breakable box with optional content
   */
  DestructibleBox: 16384,

  /**
   * collectable coin 
   */
  Coin: 32768,

  /**
   * enemy component for collision 
   */
  Enemy: 65536,

  /**
   * horizontal flyer behavior
   */
  HorizontalFlyer: 131072,

  /**
   * tag
   */
  Bee: 262144,

  /**
   * hazard entity that is not also an enemy or shell.
   */
  PassiveHazard: 524288,

  /**
   * player carry state
   */
  Carrier: 1048576,
} as const;

export type ComponentType = (typeof CT)[keyof typeof CT];

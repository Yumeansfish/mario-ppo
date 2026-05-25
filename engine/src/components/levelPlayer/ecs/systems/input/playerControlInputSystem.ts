

/**
 * adapter for input state
 * allow partial boolean value
 */
export type PlayerInputState = {
  left?: boolean;
  right?: boolean;
  jump?: boolean;
  run?: boolean;
  throw?: boolean;
};


export type PlayerOperation = {
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
  throw: boolean;
};

/**
 * convert to playerInputState -> playerOperation(must 5 boolean)
 * and consumed by movementSystem
 */
export function playerOperationFromInput(
  input: PlayerInputState = {},
): PlayerOperation {
  return {
    left: input.left ?? false,
    right: input.right ?? false,
    jump: input.jump ?? false,
    run: input.run ?? false,
    throw: input.throw ?? false,
  };
}

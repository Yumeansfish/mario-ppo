import type * as Matter from "matter-js";
import { Registry } from "../../core/Registry";
import { CT } from "../../core/ComponentTypes";
import { LifeState, MoveState } from "../../components/ComponentEnum";
import {
  HORIZONTAL_DIRECTION,
  type ActiveHorizontalDirection,
  type HorizontalDirection,
} from "../../components/ComponentClasses";
import type { PlayerOperation } from "../input/playerControlInputSystem";
import {
  H_DECEL,
  JUMP_VY,
  JUMP_GRAVITY_CUT,
  FALL_BOOST,
  MAX_FALL_VY,
} from "../../resources/physicsConfig";
import type { GameEvent } from "../../eventQueue";
import { lockRotation, setVelocityX, setVelocityY } from "./movementUtils";

//para for automatic frmae for wall jump
const WALL_JUMP_KICK_FRAMES = 10;

export function playerMovementEventSystem(
  registry: Registry,
  events: GameEvent[],
): void {
  for (const event of events) {
    switch (event.type) {
      case "PlayerBounceRequested":
        bouncePlayerForEntity(registry, event.entity);
        break;
    }
  }
}

/**
 * Handles player movement, jumping, and state synchronization.
 */
export function playerMovementSystem(
  registry: Registry,
  operation: PlayerOperation,
) {
  const entities = registry.view([CT.Player, CT.Physics, CT.Animator]);

  for (const entity of entities) {
    const control = registry.getComponent(entity, CT.Player);
    const physics = registry.getComponent(entity, CT.Physics);
    const animator = registry.getComponent(entity, CT.Animator);
    const body = physics?.body;
    if (!control || !physics || !animator || !body) continue;
    if (control.lifeState === LifeState.DYING) continue;

    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const speed = operation.run ? control.runSpeed : control.walkSpeed;
    const wallDirection = control.isOnGround
      ? null
      : getWallContactDirection(control.wallContactDirection);
    const horizontalInputDirection = getHorizontalInputDirection(operation);
    const pressingIntoWall =
      wallDirection !== null && horizontalInputDirection === wallDirection;
    const wallKickActive =
      control.wallJumpKickFrames > 0 &&
      control.wallJumpKickDirection !== HORIZONTAL_DIRECTION.NONE;

    if (control.knockbackFrames > 0) {
      control.moveState = MoveState.KNOCKBACK;
    } else if (!control.isOnGround) {
      control.moveState =
        vy > 0 ? MoveState.FALLING : MoveState.JUMPING;
    } else if (operation.left || operation.right) {
      control.moveState = MoveState.WALKING;
    } else {
      control.moveState = MoveState.IDLE;
    }

    switch (control.moveState) {
      case MoveState.KNOCKBACK:
        control.knockbackFrames--;
        setVelocityX(body, vx * H_DECEL);
        animator.currentAnim = "idle";
        break;
      case MoveState.WALKING:
        if (operation.left) {
          setVelocityX(body, -speed);
          animator.flipX = true;
        } else {
          setVelocityX(body, speed);
          animator.flipX = false;
        }
        animator.currentAnim = "walk";
        break;
      case MoveState.IDLE:
        setVelocityX(body, vx * H_DECEL);
        animator.currentAnim = "idle";
        break;
      case MoveState.JUMPING:
      case MoveState.FALLING:
        if (wallKickActive) {
          const kickDirection = control.wallJumpKickDirection;
          setVelocityX(
            body,
            getHorizontalDirectionSign(kickDirection) * control.runSpeed,
          );
          control.wallJumpKickFrames--;
          animator.flipX = kickDirection === HORIZONTAL_DIRECTION.LEFT;
          if (control.wallJumpKickFrames <= 0) {
            control.wallJumpKickDirection = HORIZONTAL_DIRECTION.NONE;
          }
        } else if (pressingIntoWall) {
          setVelocityX(body, 0);
        } else if (operation.left) {
          setVelocityX(body, -speed);
          animator.flipX = true;
        } else if (operation.right) {
          setVelocityX(body, speed);
          animator.flipX = false;
        } else {
          setVelocityX(body, vx * H_DECEL);
        }
        animator.currentAnim = "idle";
        break;
    }

    // SMB3 references:
    // https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3/Notes
    // https://github.com/velipso/smb3-physics/blob/main/index.html
    //
    // SMB3 owns vertical velocity directly: launch from a table, then each frame
    // add either a small or a large downward increment depending on jump hold and
    // current upward speed.
    //
    // Our version is the same at a high level but simpler:
    // - launch once with fixed `JUMP_VY`
    // - let Matter apply the normal per frame downward step while held
    // - add `JUMP_GRAVITY_CUT` only after early release while rising
    // - add `FALL_BOOST` once descending
    //
    // That keeps the same player-facing behavior, but avoids modeling SMB3's
    // speed-based launch table and explicit upward-speed cutoff.
    const jumpJustPressed = operation.jump && !control.jumpKeyWasDown;
    control.jumpKeyWasDown = operation.jump;
    if (control.isOnGround) {
      control.wallJumpLockDirection = HORIZONTAL_DIRECTION.NONE;
      control.wallJumpKickDirection = HORIZONTAL_DIRECTION.NONE;
      control.wallJumpKickFrames = 0;
    }
    const canWallJump =
      wallDirection !== null &&
      control.wallJumpLockDirection !== wallDirection;

    if (jumpJustPressed && (control.isOnGround || canWallJump)) {
      setVelocityY(body, JUMP_VY);
      if (wallDirection !== null) {
        const kickDirection = getOppositeHorizontalDirection(wallDirection);
        setVelocityX(
          body,
          getHorizontalDirectionSign(kickDirection) * control.runSpeed,
        );
        control.wallJumpLockDirection = wallDirection;
        control.wallJumpKickDirection = kickDirection;
        control.wallJumpKickFrames = WALL_JUMP_KICK_FRAMES;
      }
    }

    if (!control.isOnGround) {
      const vyNow = body.velocity.y;
      if (vyNow < 0 && !operation.jump) {
        setVelocityY(body, vyNow + JUMP_GRAVITY_CUT);
      } else if (vyNow > 0) {
        setVelocityY(body, Math.min(vyNow + FALL_BOOST, MAX_FALL_VY));
      }
    }

    lockRotation(body);
  }
}

function bouncePlayerForEntity(registry: Registry, entity: number): void {
  const physics = registry.getComponent(entity, CT.Physics);
  const control = registry.getComponent(entity, CT.Player);
  const body = physics?.body as Matter.Body | undefined;
  if (!body) return;

  setVelocityY(body, JUMP_VY * 0.6);
}

function getHorizontalInputDirection(
  operation: PlayerOperation,
): HorizontalDirection {
  if (operation.left === operation.right) return HORIZONTAL_DIRECTION.NONE;
  return operation.left
    ? HORIZONTAL_DIRECTION.LEFT
    : HORIZONTAL_DIRECTION.RIGHT;
}

function getWallContactDirection(
  direction: HorizontalDirection,
): ActiveHorizontalDirection | null {
  return direction === HORIZONTAL_DIRECTION.NONE ? null : direction;
}

function getOppositeHorizontalDirection(
  direction: ActiveHorizontalDirection,
): ActiveHorizontalDirection {
  return direction === HORIZONTAL_DIRECTION.LEFT
    ? HORIZONTAL_DIRECTION.RIGHT
    : HORIZONTAL_DIRECTION.LEFT;
}

function getHorizontalDirectionSign(
  direction: ActiveHorizontalDirection,
): number {
  return direction === HORIZONTAL_DIRECTION.LEFT ? -1 : 1;
}

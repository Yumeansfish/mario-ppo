/**
 * global physics parameters definition
 *
 * SMB3 two-tier jump system:
 *   JUMP_VY           initial Matter velocity. More negative = higher jump.
 *                     Keep this near -16..-35; values like -1000 launch off-screen.
 *   JUMP_GRAVITY_CUT  added each frame while rising after early release.
 *                     Higher = shorter short hop. Set to 0 for same height between
 *                     short and high jumps.
 *                     Example: 5.0 for very short hop, 0 for no difference.
 *   FALL_BOOST        added each frame while falling (speeds up descent).
 *   MAX_FALL_VY       terminal velocity cap.
 */
export const GRAVITY = 2.5;
export const JUMP_VY = -30;
export const JUMP_GRAVITY_CUT = 2.5;
export const GRAVITY_SCALE = 0.001;
export const JUMP_HOLD_FORCE = -0.8;
export const JUMP_HOLD_MAX_FRAMES = 18;
export const FALL_BOOST = 0.8;
export const MAX_FALL_VY = 18;
export const H_DECEL = 0.8;

/**
 * collision category
 */
export const CATEGORY_DEFAULT = 0x0001;
export const CATEGORY_SEMISOLID = 0x0002;
export const CATEGORY_ENEMY = 0x0004;
export const CATEGORY_COIN = 0x0008;
export const CATEGORY_DOOR = 0x0010;

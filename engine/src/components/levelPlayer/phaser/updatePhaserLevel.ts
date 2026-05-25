import Matter from "matter-js";
import { animationEventSystem, animationSystem } from "./animationSystem";
import type { PhaserRenderContext } from "./phaserAdapter";
import { renderSystem } from "./renderSystem";
import { syncTransformsFromMatter } from "../ecs/adapter/matterAdapter";
import type { GameEvent } from "../ecs/eventQueue";
import type { TileMetadataResource } from "./tileMetadata";
import { LevelRuntime, updateRuntime } from "../ecs/headlessRuntime/update";
import {
  playerOperationFromInput,
  type PlayerInputState,
} from "../ecs/systems/input/playerControlInputSystem";
import { InputRecorder } from "../ecs/inputRecorder";
import { processRuntimeEvents } from "../ecs/systems/runtimeEvents";
import {
  DEATH_RESTART_DELAY,
  DEATH_SHAKE_DURATION,
  DEATH_SHAKE_INTENSITY,
  FALL_RESTART_DELAY,
} from "./phaserConstants";
import { CT } from "../ecs/core/ComponentTypes";

type PhaserRuntimeState = {
  isDying: boolean;
  isLevelComplete: boolean;
  forcedFlyY: number | null;
  sineFly: {
    amplitude: number;
    periodMs: number;
    centerY: number;
    startTime: number;
  } | null;
  doorStartPositions: Map<number, { x: number; y: number }>;
  /// Fixed timestep accumulator.
  ///
  /// Anticheat strategy for framerate / timeScale tampering (setFps() cheats).
  /// Three layers work together to make it unspoofable:
  ///
  /// Layer 1: Fixed timestep accumulator
  /// --------------------------------
  /// Wallclock delta from Phaser is accumulated; physics steps are popped
  /// off at exactly 1000/60 ms intervals. Input is recorded inside the
  /// accumulator loopp: once per physics step, not once per Phaser frame.
  /// This means even with setFps(40) the browser records ~60 input entries
  /// per second of wall time, exactly like the headless replay.
  /// Without this, setFps(40) would cause the browser to record 40 entries/s
  /// while the replay simulates all 40 at normal speed, a 50 % physics
  /// mismatch that makes timeScale tampering invisible on simple levels.
  ///
  /// The accumulator is capped at 4 steps (~67 ms) to prevent tab
  /// backgrounding (1000+ ms delta) from freezing the browser.
  ///
  /// Layer 2: Stop recording at completion
  /// --------------------------------
  /// Once isLevelComplete is set, the record() call is skipped. No post-
  /// completion idle frames inflate totalFrames. The input log has exactly
  /// as many entries as the browser needed to reach the door.
  ///
  /// Layer 3: Frame-count comparison (backend)
  /// --------------------------------
  /// When timeScale < 1.0 (slow-mo), each physics step moves the player
  /// less. The browser needs more steps → records more entries. The replay
  /// processes them all at timeScale = 1.0 → reaches the door earlier →
  /// reports a lower frame count. The backend compares |replay.frames
  /// totalFrames| and flags anything beyond ±5 as CHEATED.
  ///
  /// This cannot be spoofed by lying about timeScale in the payload because
  /// the frame count mismatch is a consequence of the physics simulation
  /// itself, not of any client reported metadata.
  fixedDtAccumulator: number;
};

export type LevelCompletedPayload = {
  inputLog: ReturnType<InputRecorder["getLog"]>;
  totalFrames: number;
};

export type PhaserLevelCallbacks = {
  onSceneReady?: (scene: Phaser.Scene) => void;
  onRunStarted?: () => void;
  onAttemptFailed?: (payload: { reason: string }) => void;
  onCoinCollected?: (coinType: string) => void;
  onEnemyKilled?: (enemyType: string) => void;
  onBoxDestroyed?: (content?: string) => void;
  onLevelCompleted?: (payload: LevelCompletedPayload) => void;
};

export type PhaserLevelRuntime = LevelRuntime & {
  renderContext: PhaserRenderContext;
  tileMetadata: TileMetadataResource;
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  throwKey: Phaser.Input.Keyboard.Key;
  state: PhaserRuntimeState;
  callbacks: PhaserLevelCallbacks;
  player: Phaser.GameObjects.Sprite | undefined;
  inputRecorder: InputRecorder;
  completeLevel: () => void;
};

const FIXED_DT = 1000 / 60;

export function updatePhaserLevel(
  runtime: PhaserLevelRuntime,
  scene: Phaser.Scene,
  _time: number,
  delta: number,
): void {
  runtime.state.fixedDtAccumulator += delta;
  // Cap the accumulator so that tab-backgrounding (where delta can be
  // 1000+ ms) doesn't run hundreds of physics steps in one frame,
  // which would freeze the browser. Four steps (~67 ms) is enough to
  // catch up from a minor GC pause without hitching.
  runtime.state.fixedDtAccumulator = Math.min(
    runtime.state.fixedDtAccumulator,
    FIXED_DT * 4,
  );

  while (runtime.state.fixedDtAccumulator >= FIXED_DT) {
    // Sample cursor state once per physics step so recording and
    // physics input stay in sync. Without this, two cursor reads in
    // the same iteration could capture different key states.
    const stepInput = playerInputFromCursors(runtime.cursors, runtime.throwKey);

    // Record input once per physics step, not once per Phaser frame.
    // This ensures the input log density (~60 entries/second of wall
    // time) is independent of the render rate, so FPS changes (setFps,
    // browser throttling) don't break frame-count comparisons.
    // Stop recording after level completion, post-completion idle
    // frames must not inflate totalFrames.
    if (!runtime.state.isLevelComplete) {
      runtime.inputRecorder.record(stepInput);
    }
    // First update ECS + Matter. Then update Phaser sprites and animations.
    const events = updateRuntime(runtime, {
      input: playerOperationFromInput(stepInput),
      deltaMs: FIXED_DT,
      skipPlayerInput: runtime.state.isDying || runtime.state.isLevelComplete,
    });

    processPhaserGameEvents(runtime, scene, events);

    runtime.state.fixedDtAccumulator -= FIXED_DT;

    if (runtime.state.isLevelComplete) {
      animationSystem(runtime.renderContext, runtime.registry);
      return;
    }
  }

  if (runtime.state.isLevelComplete) {
    animationSystem(runtime.renderContext, runtime.registry);
    return;
  }

  applyRuntimeCheats(runtime, _time);

  syncTransformsFromMatter(runtime.registry);
  renderSystem(runtime.renderContext, runtime.registry, runtime.tileMetadata);
  animationSystem(runtime.renderContext, runtime.registry);
}

function applyRuntimeCheats(runtime: PhaserLevelRuntime, time: number): void {
  const physics = runtime.registry.getComponent(
    runtime.playerEntity,
    CT.Physics,
  );
  const body = physics?.body;
  if (!body) return;

  if (runtime.state.forcedFlyY !== null) {
    Matter.Body.setVelocity(body, { x: body.velocity.x, y: 0 });
    Matter.Body.setPosition(body, {
      x: body.position.x,
      y: runtime.state.forcedFlyY,
    });
    return;
  }

  const sineFly = runtime.state.sineFly;
  if (!sineFly) return;

  const phase = ((time - sineFly.startTime) / sineFly.periodMs) * Math.PI * 2;
  Matter.Body.setVelocity(body, { x: body.velocity.x, y: 0 });
  Matter.Body.setPosition(body, {
    x: body.position.x,
    y: sineFly.centerY + Math.sin(phase) * sineFly.amplitude,
  });
}

function processPhaserGameEvents(
  runtime: PhaserLevelRuntime,
  scene: Phaser.Scene,
  events: GameEvent[],
): void {
  const wasComplete = runtime.levelState.isComplete;
  processRuntimeEvents(runtime, events);

  if (!wasComplete && runtime.levelState.isComplete) {
    runtime.completeLevel();
  }

  animationEventSystem(runtime.renderContext, runtime.tileMetadata, events, {
    onCoinPopComplete: runtime.callbacks.onCoinCollected,
  });
  forwardGameEventsToUi(runtime, scene, events);
}

function playerInputFromCursors(
  cursors: Phaser.Types.Input.Keyboard.CursorKeys,
  throwKey: Phaser.Input.Keyboard.Key,
): PlayerInputState {
  return {
    left: cursors.left.isDown,
    right: cursors.right.isDown,
    jump: cursors.up.isDown,
    run: cursors.shift.isDown,
    throw: throwKey.isDown,
  };
}

function restartAfterFailure(
  runtime: PhaserLevelRuntime,
  scene: Phaser.Scene,
  reason: string,
): void {
  if (runtime.state.isDying) return;

  runtime.state.isDying = true;
  runtime.callbacks.onAttemptFailed?.({ reason });
  scene.time.delayedCall(FALL_RESTART_DELAY, () => {
    scene.scene.restart();
  });
}

function forwardGameEventsToUi(
  runtime: PhaserLevelRuntime,
  scene: Phaser.Scene,
  events: GameEvent[],
): void {
  for (const event of events) {
    switch (event.type) {
      case "CoinCollected":
        if (event.animated) break;
        runtime.callbacks.onCoinCollected?.(event.coinType);
        break;
      case "EnemyKilled":
        runtime.callbacks.onEnemyKilled?.(event.enemyType);
        break;
      case "BoxDestroyed":
        runtime.callbacks.onBoxDestroyed?.(event.content);
        break;
      case "PlayerDied":
        if (runtime.state.isDying) break;
        runtime.state.isDying = true;
        scene.cameras.main.shake(DEATH_SHAKE_DURATION, DEATH_SHAKE_INTENSITY);
        runtime.callbacks.onAttemptFailed?.({ reason: "damage" });
        scene.time.delayedCall(DEATH_RESTART_DELAY, () => {
          scene.scene.restart();
        });
        break;
      case "GameOver":
        if (runtime.state.isDying) break;
        restartAfterFailure(runtime, scene, "fall");
        break;
    }
  }
}

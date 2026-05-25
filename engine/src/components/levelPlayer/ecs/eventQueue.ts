export type GameEvent =
  | {
      type: "BurstRequested";
      x: number;
      y: number;
      texture: string;
      frame: string | number;
    }
  | { type: "CoinPopRequested"; x: number; y: number; coinType: string }
  | { type: "HorizontalWalkerReverseRequested"; entity: number }
  | { type: "HorizontalFlyerReverseRequested"; entity: number }
  | { type: "PlayerBounceRequested"; entity: number }
  | {
      type: "PlayerDamageContactStarted";
      playerEntity: number;
      hazardEntity: number;
    }
  | {
      type: "PlayerDamageContactEnded";
      playerEntity: number;
      hazardEntity: number;
    }
  | {
      type: "ShellEquipRequested";
      playerEntity: number;
      shellEntity: number;
    }
  | {
      type: "ShellThrowRequested";
      playerEntity: number;
      releaseVx: number;
      isRunning: boolean;
    }
  | { type: "PlayerTookDamage"; entity: number }
  | { type: "PlayerDied" }
  | { type: "BoxDestroyed"; content?: string }
  | { type: "CoinCollected"; coinType: string; animated?: boolean }
  | { type: "EnemyKilled"; enemyType: string }
  | { type: "PlayerEnteredDoor" }
  | { type: "GameOver" };

/**
 * interface for event producer
 */
export type EventSink = {
  emit(event: GameEvent): void;
};

export class EventQueue implements EventSink {
  private events: GameEvent[] = [];

  emit(event: GameEvent): void {
    this.events.push(event);
  }

  drain(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}

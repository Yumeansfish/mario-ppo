import type { GameEvent } from "../../eventQueue";
import { CT } from "../../core/ComponentTypes";
import type { Registry } from "../../core/Registry";
import {
  isClearConditionSatisfied,
  type LevelStateResource,
} from "../../resources/levelState";

export function levelStateSystem(
  registry: Registry,
  levelState: LevelStateResource,
  events: GameEvent[],
): void {
  for (const event of events) {
    switch (event.type) {
      case "CoinCollected":
        incrementClearConditionIfMatches(levelState, "coin");
        break;

      case "EnemyKilled":
        incrementClearConditionIfMatches(levelState, event.enemyType);
        break;

      case "BoxDestroyed":
        incrementClearConditionIfMatches(levelState, "box");
        break;

      case "PlayerEnteredDoor":
        if (levelState.doorOpen) levelState.isComplete = true;
        break;

      // PlayerDied need emit event to phaser to show the animation. gameover doesnt 
      // need do it. But in levelState they are same so normalize them
      case "GameOver":
      case "PlayerDied":
        levelState.gameOver = true;
        break;
    }
  }

  if (isClearConditionSatisfied(levelState)) {
    levelState.doorOpen = true;
  }
  syncDoorState(registry, levelState.doorOpen);
}

function syncDoorState(registry: Registry, isOpen: boolean): void {
  for (const entity of registry.view([CT.Door])) {
    const door = registry.getComponent(entity, CT.Door);
    if (!door) continue;
    door.isOpen = isOpen;
  }
}

function incrementClearConditionIfMatches(
  levelState: LevelStateResource,
  eventTarget: string,
): void {
  const conditionType = levelState.clearCondition.type;
  if (conditionType === "none") return;

  if (!eventTarget.toLowerCase().includes(conditionType)) return;

  levelState.clearCondition.currentAmount++;
}

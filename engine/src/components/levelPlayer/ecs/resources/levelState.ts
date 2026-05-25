export type ClearConditionType = string;

export type ClearConditionState = {
  type: ClearConditionType;
  currentAmount: number;
  requiredAmount: number;
};

export type LevelStateResource = {
  clearCondition: ClearConditionState;
  doorOpen: boolean;
  isComplete: boolean;
  gameOver: boolean;
};

export type LevelStateOptions = {
  clearConditionType?: string;
  clearConditionRequiredAmount?: number;
};

type MapProperty = {
  name: string;
  value: string;
};

export function createLevelStateResource(
  options: LevelStateOptions = {},
): LevelStateResource {
  return {
    clearCondition: {
      type: options.clearConditionType?.toLowerCase() ?? "none",
      currentAmount: 0,
      requiredAmount: options.clearConditionRequiredAmount ?? 0,
    },
    doorOpen: false,
    isComplete: false,
    gameOver: false,
  };
}

export function createLevelStateResourceFromMapProperties(
  properties: MapProperty[] = [],
): LevelStateResource {
  const typeProp = properties.find(
    (property) => property.name === "ClearConditionType",
  );
  const amountProp = properties.find(
    (property) => property.name === "ClearConditionAmount",
  );

  if (!typeProp || typeof typeProp.value !== "string") {
    throw new Error("ClearConditionType map prop is malformed");
  }

  const requiredAmount = Number(amountProp?.value);
  if (!amountProp || Number.isNaN(requiredAmount)) {
    throw new Error("ClearConditionAmount map prop is malformed");
  }

  return createLevelStateResource({
    clearConditionType: typeProp.value,
    clearConditionRequiredAmount: requiredAmount,
  });
}

export function isClearConditionSatisfied(
  levelState: LevelStateResource,
): boolean {
  const { type, currentAmount, requiredAmount } = levelState.clearCondition;
  return (
    type === "none" || requiredAmount === 0 || currentAmount >= requiredAmount
  );
}
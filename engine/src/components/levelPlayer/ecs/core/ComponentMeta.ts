import * as Comp from "../components/ComponentClasses";
import { CT } from "./ComponentTypes";

/**
 * @author Valerie Burgener <burgev@usi.ch>
 * Kindly contributed the idea and code {@link CTsToType} and its dependencies
 * thank you!
 */
type CompKey = keyof typeof Comp;

type BitOf<T extends CompKey> = (typeof Comp)[T] extends {
  bit: infer V extends ComponentType;
}
  ? V
  : never;

type InstanceOf<T extends CompKey> = InstanceType<(typeof Comp)[T]>;

export type CTsToType = {
  [K in keyof typeof Comp as BitOf<K>]: InstanceOf<K>;
};

export type ComponentType = (typeof CT)[keyof typeof CT];

type TypesToCT<T> = {
  [K in keyof CTsToType]: T extends CTsToType[K] ? K : never;
};

type TypeByComp<T> = TypesToCT<T>[keyof CTsToType];

export function bitFromComp<T extends Comp.Component>(
  component: T,
): TypeByComp<T> {
  return (
    component.constructor as unknown as {
      bit: TypeByComp<T>;
    }
  ).bit;
}

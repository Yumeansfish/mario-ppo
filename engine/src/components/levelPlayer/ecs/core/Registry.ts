import { CTsToType, ComponentType, bitFromComp } from "./ComponentMeta";
import * as CC from "../components/ComponentClasses";
import { CT } from "./ComponentTypes";
type EntityId = number;
type Signature = number;

/**
 * Manages entities and their components. TODO: ensure type safety in getComponent
 */
export class Registry {
  // for each component type we keep track of (entityId -> component data)
  private nextEntityId = 1;
  private pools = new Map<ComponentType, Map<EntityId, CC.Component>>();
  // each entity has its own signature based on the component(s) it has
  private signatures = new Map<EntityId, Signature>();
  // Matter bodyId -> entityId
  private bodyToEntity = new Map<number, EntityId>();

  constructor() {
    for (const bit of Object.values(CT)) {
      this.pools.set(bit, new Map<number, CC.Component>());
    }
  }

  linkBody(entity: number, body: { id: number }): void {
    this.bodyToEntity.set(body.id, entity);
  }

  unlinkBody(bodyId: number): void {
    this.bodyToEntity.delete(bodyId);
  }

  getEntityByBodyId(bodyId: number): number | undefined {
    return this.bodyToEntity.get(bodyId);
  }

  getSignature(entity: number): number {
    return this.signatures.get(entity) ?? 0;
  }

  /**
   * Creates a new entity.
   */
  createEntity(): number {
    const entity = this.nextEntityId++;
    this.signatures.set(entity, 0);
    return entity;
  }

  /**
   * Removes an entity and all its components.
   */
  destroyEntity(entity: number): void {
    const signature = this.signatures.get(entity);
    if (signature === undefined) return;
    for (const type of Object.values(CT)) {
      this.removeComponent(entity, type);
    }
    this.signatures.delete(entity);
  }

  /**
   * Adds a component to an entity.
   */
  addComponent<T extends CC.Component>(entity: EntityId, data: T): void {
    const type = bitFromComp(data);

    const pool = this.pools.get(type);
    if (!pool) throw new Error(`Pool ${type} not found`);

    pool.set(entity, data);

    const currentSig = this.signatures.get(entity) ?? 0;
    this.signatures.set(entity, currentSig | type);
  }

  /**
   * Removes a component from an entity.
   */
  removeComponent(entity: number, type: ComponentType): void {
    const pool = this.pools.get(type);
    if (pool && this.hasComponent(entity, type)) {
      pool.delete(entity);
      const currentSig = this.signatures.get(entity) || 0;
      this.signatures.set(entity, currentSig & ~type);
    }
  }

  /**
   * Returns a component from an entity. (use keyof and give type)
   */
  getComponent<T extends keyof CTsToType>(
    entity: EntityId,
    type: T,
  ): CTsToType[T] | undefined {
    return this.pools.get(type)?.get(entity) as CTsToType[T] | undefined;
  }

  /**
   * Checks if an entity has a specific component.
   */
  hasComponent(entity: number, type: ComponentType): boolean {
    const signature = this.signatures.get(entity);
    return signature !== undefined && (signature & type) === type;
  }

  /**
   * Returns IDs for entities that have all specified components.
   */
  view(types: ComponentType[]): EntityId[] {
    if (types.length === 0) return [];

    const systemMask = types.reduce((mask, type) => mask | type, 0);
    const pools = types.map((type) => this.pools.get(type));

    let smallestPool = pools[0]!;
    for (let i = 1; i < pools.length; i++) {
      const pool = pools[i]!;
      if (pool.size < smallestPool.size) smallestPool = pool;
    }

    const result: EntityId[] = [];
    for (const entityId of smallestPool.keys()) {
      const entitySignature = this.signatures.get(entityId)!;

      if ((entitySignature & systemMask) === systemMask) {
        result.push(entityId);
      }
    }
    return result;
  }
}

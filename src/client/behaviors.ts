export {
  behavior,
  createBehaviorRuntime,
  type Behavior,
  type BehaviorCleanup,
  type BehaviorClientModule,
  type BehaviorClientModules,
  type BehaviorMount,
  type BehaviorMountContext,
  type BehaviorRuntime,
  type CreateBehaviorRuntimeOptions,
} from '../runtime/behaviors'
export {
  destroyClientRuntimes,
  mountClientRuntimes,
  registerClientRuntime,
  unmountClientRuntimes,
  type ClientRuntimeController,
} from '../runtime/coordinator'

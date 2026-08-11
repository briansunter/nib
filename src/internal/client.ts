/** @internal Runtime entry used by Nib's generated browser modules. */
export {
  createBehaviorRuntime,
  type BehaviorClientModule,
  type BehaviorClientModules,
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

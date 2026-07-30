export const MAX_SERIALIZED_PROPS_LENGTH = 64 * 1024

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

type IsAny<Value> = 0 extends (1 & Value) ? true : false
type IsBroadObject<Value> = [Value] extends [object]
  ? [object] extends [Value] ? true : false
  : false
type IsOptionalKey<Value extends object, Key extends keyof Value> = {} extends Pick<Value, Key>
  ? true
  : false
type IsJsonValue<Value> = IsAny<Value> extends true
  ? false
  : [Value] extends [never | undefined]
    ? false
    : [Value] extends [null | string | number | boolean]
      ? true
      : Value extends (...args: never[]) => unknown
        ? false
        : Value extends readonly (infer Item)[]
          ? IsJsonValue<Item>
          : Value extends object
            ? JsonSerializableObject<Value>
            : false

/** Compile-time counterpart to the runtime serializer's plain JSON contract. */
export type JsonSerializableObject<Value extends object> = Value extends unknown
  ? IsBroadObject<Value> extends true
    ? false
    : keyof Value extends never
      ? true
      : false extends {
          [Key in keyof Value]-?: IsOptionalKey<Value, Key> extends true
            ? IsJsonValue<Exclude<Value[Key], undefined>>
            : IsJsonValue<Value[Key]>
        }[keyof Value]
        ? false
        : true
  : never

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function validateValue(value: unknown, path: string, ancestors: Set<object>): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new Error(`Island prop ${path} must be a finite JSON number`)
    }
    return
  }
  if (value === undefined) throw new Error(`Island prop ${path} cannot be undefined`)
  if (typeof value !== 'object') {
    throw new Error(`Island prop ${path} is not JSON-serializable`)
  }
  if (ancestors.has(value)) throw new Error(`Island prop ${path} contains a cycle`)

  ancestors.add(value)
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) throw new Error(`Island prop ${path} cannot contain sparse arrays`)
      validateValue(value[index], `${path}[${index}]`, ancestors)
    }
  } else {
    if (!isPlainObject(value)) {
      throw new Error(`Island prop ${path} must be a plain object`)
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new Error(`Island prop ${path} cannot have symbol keys`)
    }
    for (const [key, child] of Object.entries(value)) {
      validateValue(child, `${path}.${key}`, ancestors)
    }
  }
  ancestors.delete(value)
}

function validatePropsObject(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || !isPlainObject(value)) {
    throw new Error('Island props must be a plain object')
  }
  validateValue(value, 'props', new Set())
}

export function serializeIslandProps(props: object): string {
  validatePropsObject(props)
  const serialized = JSON.stringify(props)
  if (serialized.length > MAX_SERIALIZED_PROPS_LENGTH) {
    throw new Error(`Island props exceed ${MAX_SERIALIZED_PROPS_LENGTH} serialized characters`)
  }
  return serialized
}

export function parseIslandProps(serialized: string): Record<string, unknown> {
  if (serialized.length > MAX_SERIALIZED_PROPS_LENGTH) {
    throw new Error(`Island props exceed ${MAX_SERIALIZED_PROPS_LENGTH} serialized characters`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch (error) {
    throw new Error('Island props contain invalid JSON', { cause: error })
  }
  validatePropsObject(parsed)
  return parsed
}

/**
 * Neutral serialization aliases shared by behaviors and islands. Behaviors
 * route through these so they no longer import island-named primitives.
 */
export { serializeIslandProps as serializeClientProps, parseIslandProps as parseClientProps }

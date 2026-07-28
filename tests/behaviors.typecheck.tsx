import { defineClientBehavior } from '../src/framework/behaviors'

defineClientBehavior<{ label: string; count?: number }>('valid')

const Empty = defineClientBehavior('empty')
;<Empty />

const Required = defineClientBehavior<{ label: string }>('required')
// @ts-expect-error required behavior props cannot be omitted
;<Required />
;<Required props={{ label: 'Details' }} />

// @ts-expect-error behavior props must be JSON-serializable
defineClientBehavior<{ onClick: () => void }>('invalid-function')

// @ts-expect-error behavior props must be JSON-serializable
defineClientBehavior<{ createdAt: Date }>('invalid-date')

// @ts-expect-error broad object props do not prove serializability
defineClientBehavior<{ value: object }>('invalid-object')

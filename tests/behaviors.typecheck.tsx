import { defineClientBehavior } from '../src/framework/behaviors'

defineClientBehavior<{ label: string; count?: number }>('valid')

// @ts-expect-error behavior props must be JSON-serializable
defineClientBehavior<{ onClick: () => void }>('invalid-function')

// @ts-expect-error behavior props must be JSON-serializable
defineClientBehavior<{ createdAt: Date }>('invalid-date')

// @ts-expect-error broad object props do not prove serializability
defineClientBehavior<{ value: object }>('invalid-object')

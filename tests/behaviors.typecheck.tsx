import { Behavior } from '../src/framework/behaviors'

;<Behavior name="valid"><div /></Behavior>
;<Behavior name="deferred" defer="visible"><div /></Behavior>

// @ts-expect-error behaviors only accept idle or visible deferral
;<Behavior name="invalid" defer="load"><div /></Behavior>

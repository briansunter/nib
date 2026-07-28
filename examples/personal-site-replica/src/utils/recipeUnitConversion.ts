import { getMetricVolumeIngredientMassRule } from './ingredientConversionPolicy';
import { normalizeUnit } from './unitNormalization';

// Re-exported so existing importers (recipeUtils, recipeQuantityDisplay, tests)
// keep resolving normalizeUnit from this module.
export { normalizeUnit };

export type UnitDimension = 'length' | 'mass' | 'temperature' | 'volume';

export const MASS_TO_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};

export const VOLUME_TO_MILLILITERS: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  'fl oz': 29.5735295625,
  cup: 236.5882365,
  pt: 473.176473,
  qt: 946.352946,
  gal: 3785.411784,
};

const LENGTH_TO_CENTIMETERS: Record<string, number> = {
  cm: 1,
  m: 100,
  in: 2.54,
  ft: 30.48,
};

const UNIT_DIMENSIONS: Record<string, UnitDimension> = {
  g: 'mass',
  kg: 'mass',
  oz: 'mass',
  lb: 'mass',
  ml: 'volume',
  l: 'volume',
  tsp: 'volume',
  tbsp: 'volume',
  'fl oz': 'volume',
  cup: 'volume',
  pt: 'volume',
  qt: 'volume',
  gal: 'volume',
  '°C': 'temperature',
  '°F': 'temperature',
  cm: 'length',
  m: 'length',
  in: 'length',
  ft: 'length',
};

const METRIC_UNITS = new Set(['g', 'kg', 'ml', 'l', 'cm', 'm', '°C']);
const SPECIAL_UNITS = new Set(['', 'large', 'small', 'medium']);

export function scaleQuantity(quantity: number, scale: number): number {
  return quantity * scale;
}

export function isMetricUnit(unit: string): boolean {
  return METRIC_UNITS.has(normalizeUnit(unit));
}

export function convertIngredient(
  quantity: number,
  unit: string,
  name: string,
  isMetric: boolean,
): [number, string] {
  const normalizedUnit = normalizeUnit(unit);

  if (SPECIAL_UNITS.has(normalizedUnit)) {
    return [quantity, normalizedUnit];
  }

  if (isMetric) {
    const volumeIngredientMetricMass = convertVolumeIngredientToMetricMass(
      quantity,
      normalizedUnit,
      name,
    );
    if (volumeIngredientMetricMass) {
      return volumeIngredientMetricMass;
    }
  }

  if (isMetric === isMetricUnit(normalizedUnit)) {
    return [quantity, normalizedUnit];
  }

  const dimension = UNIT_DIMENSIONS[normalizedUnit];
  if (!dimension) {
    return [quantity, normalizedUnit];
  }

  switch (dimension) {
    case 'mass':
      return isMetric
        ? convertMassToMetric(quantity, normalizedUnit)
        : convertMassToImperial(quantity, normalizedUnit);
    case 'volume':
      return isMetric
        ? convertVolumeToMetric(quantity, normalizedUnit)
        : convertVolumeToImperial(quantity, normalizedUnit);
    case 'temperature':
      return isMetric
        ? [Math.round(fahrenheitToCelsius(quantity)), '°C']
        : [Math.round(celsiusToFahrenheit(quantity)), '°F'];
    case 'length':
      return isMetric
        ? convertLengthToMetric(quantity, normalizedUnit)
        : convertLengthToImperial(quantity, normalizedUnit);
    default: {
      // Exhaustiveness guard: a new UnitDimension becomes a compile error here
      // rather than silently falling through to an unconverted passthrough.
      const _exhaustive: never = dimension;
      return _exhaustive;
    }
  }
}

function convertVolumeIngredientToMetricMass(
  quantity: number,
  unit: string,
  name: string,
): [number, string] | null {
  if (!(unit in VOLUME_TO_MILLILITERS)) {
    return null;
  }

  const rule = getMetricVolumeIngredientMassRule(name, unit);
  if (!rule) {
    return null;
  }

  const cups =
    (quantity * VOLUME_TO_MILLILITERS[unit]) / VOLUME_TO_MILLILITERS.cup;
  return convertMassToMetric(cups * rule.gramsPerCup, 'g');
}

function convertMassToMetric(quantity: number, unit: string): [number, string] {
  const grams = quantity * MASS_TO_GRAMS[unit];

  if (grams >= 1000) {
    return [roundToPrecision(grams / MASS_TO_GRAMS.kg, 2), 'kg'];
  }

  return [Math.round(grams), 'g'];
}

function convertMassToImperial(
  quantity: number,
  unit: string,
): [number, string] {
  const ounces = (quantity * MASS_TO_GRAMS[unit]) / MASS_TO_GRAMS.oz;

  if (ounces >= 16) {
    return [roundImperialValue(ounces / 16), 'lb'];
  }

  return [roundImperialValue(ounces), 'oz'];
}

function convertVolumeToMetric(
  quantity: number,
  unit: string,
): [number, string] {
  const milliliters = quantity * VOLUME_TO_MILLILITERS[unit];

  if (milliliters >= 1000) {
    return [roundToPrecision(milliliters / VOLUME_TO_MILLILITERS.l, 2), 'l'];
  }

  return [Math.round(milliliters), 'ml'];
}

function convertVolumeToImperial(
  quantity: number,
  unit: string,
): [number, string] {
  const milliliters = quantity * VOLUME_TO_MILLILITERS[unit];

  if (milliliters < VOLUME_TO_MILLILITERS.tbsp) {
    return [roundImperialValue(milliliters / VOLUME_TO_MILLILITERS.tsp), 'tsp'];
  }

  if (milliliters < 80) {
    return [
      roundImperialValue(milliliters / VOLUME_TO_MILLILITERS.tbsp),
      'tbsp',
    ];
  }

  const cups = milliliters / VOLUME_TO_MILLILITERS.cup;
  const roundedCups = roundToQuarter(cups);
  if (cups >= 0.25 && Math.abs(cups - roundedCups) <= 0.12) {
    return [roundedCups, 'cup'];
  }

  const fluidOunces = milliliters / VOLUME_TO_MILLILITERS['fl oz'];
  if (fluidOunces < 8) {
    return [roundImperialValue(fluidOunces), 'fl oz'];
  }

  if (milliliters < VOLUME_TO_MILLILITERS.gal) {
    return [roundImperialValue(cups), 'cup'];
  }

  return [roundImperialValue(milliliters / VOLUME_TO_MILLILITERS.gal), 'gal'];
}

function convertLengthToMetric(
  quantity: number,
  unit: string,
): [number, string] {
  const centimeters = quantity * LENGTH_TO_CENTIMETERS[unit];

  if (centimeters >= 100) {
    return [roundToPrecision(centimeters / LENGTH_TO_CENTIMETERS.m, 2), 'm'];
  }

  return [roundToPrecision(centimeters, centimeters < 10 ? 2 : 1), 'cm'];
}

function convertLengthToImperial(
  quantity: number,
  unit: string,
): [number, string] {
  const inches =
    (quantity * LENGTH_TO_CENTIMETERS[unit]) / LENGTH_TO_CENTIMETERS.in;

  if (inches >= 12) {
    return [roundToPrecision(inches / 12, 2), 'ft'];
  }

  return [roundToPrecision(inches, inches < 10 ? 2 : 1), 'in'];
}

function celsiusToFahrenheit(value: number): number {
  return (value * 9) / 5 + 32;
}

function fahrenheitToCelsius(value: number): number {
  return ((value - 32) * 5) / 9;
}

function roundToPrecision(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

function roundImperialValue(value: number): number {
  if (value < 1) {
    return roundToPrecision(value, 2);
  }

  return roundToQuarter(value);
}

function roundToQuarter(num: number): number {
  return Math.round(num * 4) / 4;
}

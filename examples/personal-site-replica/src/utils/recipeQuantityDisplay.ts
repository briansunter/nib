import {
  convertIngredient,
  normalizeUnit,
  scaleQuantity,
} from './recipeUnitConversion';

export type ParsedRecipeQuantity =
  | { kind: 'number'; value: number }
  | { kind: 'range'; start: number; end: number }
  | { kind: 'text'; value: string };

export type QuantityDisplay = {
  changed: boolean;
  quantityText: string;
};

export type QuantityDisplayOptions = {
  quantity: string | null;
  units: string;
  ingredientName: string;
  scale: number;
  isMetric: boolean;
};

const SCALE_EPSILON = 1e-9;

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 1 / 4,
  '½': 1 / 2,
  '¾': 3 / 4,
  '⅐': 1 / 7,
  '⅑': 1 / 9,
  '⅒': 1 / 10,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};

export function roundToReadableNumber(num: number): string {
  if (Number.isInteger(num)) {
    return num.toString();
  }
  if (num < 0.125) {
    return num.toFixed(2);
  }
  return num.toFixed(1);
}

export function parseRecipeQuantity(raw: string | null): ParsedRecipeQuantity {
  const s = (raw ?? '').trim();
  if (!s) return { kind: 'number', value: 0 };

  const range = s.match(/^(.+?)\s*(?:-|\u2013|\u2014|\bto\b)\s*(.+)$/i);
  if (range) {
    const start = parseSingleNumber(range[1]);
    const end = parseSingleNumber(range[2]);
    if (start !== null && end !== null) {
      return { kind: 'range', start, end };
    }
  }

  const number = parseSingleNumber(s);
  if (number !== null) {
    return { kind: 'number', value: number };
  }

  return { kind: 'text', value: s };
}

export function formatQuantityDisplay(
  options: QuantityDisplayOptions,
): QuantityDisplay {
  const parsed = parseRecipeQuantity(options.quantity);
  const normalizedUnits = normalizeUnit(options.units);

  if (parsed.kind === 'text') {
    return {
      changed: false,
      quantityText: joinQtyUnits(parsed.value, normalizedUnits),
    };
  }

  const convertValue = (value: number): [number, string] => {
    let newQuantity = scaleQuantity(value, options.scale);
    let newUnits = normalizedUnits;
    [newQuantity, newUnits] = convertIngredient(
      newQuantity,
      newUnits,
      options.ingredientName,
      options.isMetric,
    );
    return [newQuantity, newUnits];
  };

  if (parsed.kind === 'range') {
    const [start, startUnits] = convertValue(parsed.start);
    const [end, endUnits] = convertValue(parsed.end);
    const sameUnits = startUnits === endUnits;
    const quantityText = sameUnits
      ? joinQtyUnits(
          `${roundToReadableNumber(start)}-${roundToReadableNumber(end)}`,
          startUnits,
        )
      : `${joinQtyUnits(
          roundToReadableNumber(start),
          startUnits,
        )}-${joinQtyUnits(roundToReadableNumber(end), endUnits)}`;

    return {
      changed:
        hasScaleChange(options.scale) ||
        startUnits !== normalizedUnits ||
        endUnits !== normalizedUnits ||
        start !== parsed.start ||
        end !== parsed.end,
      quantityText,
    };
  }

  const [newQuantity, newUnits] = convertValue(parsed.value);
  return {
    changed:
      hasScaleChange(options.scale) ||
      newUnits !== normalizedUnits ||
      newQuantity !== parsed.value,
    quantityText: joinQtyUnits(roundToReadableNumber(newQuantity), newUnits),
  };
}

export function formatTimerQuantity(
  quantity: string | null,
  units: string,
): string {
  const parsed = parseRecipeQuantity(quantity);

  if (parsed.kind === 'range') {
    return joinQtyUnits(
      `${roundToReadableNumber(parsed.start)}-${roundToReadableNumber(parsed.end)}`,
      units,
    );
  }

  if (parsed.kind === 'text') {
    return joinQtyUnits(parsed.value, units);
  }

  return joinQtyUnits(roundToReadableNumber(parsed.value), units);
}

export function joinQtyUnits(qty: string, units: string): string {
  return units ? `${qty} ${units}` : qty;
}

export function isTimeUnit(unit: string): boolean {
  const timeUnits = [
    'second',
    'seconds',
    'minute',
    'minutes',
    'hour',
    'hours',
    'day',
    'days',
    'week',
    'weeks',
    'month',
    'months',
    'year',
    'years',
  ];
  return timeUnits.includes(unit.toLowerCase());
}

function parseSingleNumber(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  const unicodeFraction = s.match(
    /^(\d+(?:\.\d+)?)?\s*([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/,
  );
  if (unicodeFraction) {
    const whole = unicodeFraction[1]
      ? Number.parseFloat(unicodeFraction[1])
      : 0;
    return whole + UNICODE_FRACTIONS[unicodeFraction[2]];
  }

  const mixed = s.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = Number.parseFloat(mixed[1]);
    const numerator = Number.parseFloat(mixed[2]);
    const denominator = Number.parseFloat(mixed[3]);
    return denominator === 0 ? null : whole + numerator / denominator;
  }

  const fraction = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const numerator = Number.parseFloat(fraction[1]);
    const denominator = Number.parseFloat(fraction[2]);
    return denominator === 0 ? null : numerator / denominator;
  }

  const decimal = s.match(/^-?\d+(?:\.\d+)?$/);
  return decimal ? Number.parseFloat(s) : null;
}

function hasScaleChange(scale: number): boolean {
  return Math.abs(scale - 1) > SCALE_EPSILON;
}

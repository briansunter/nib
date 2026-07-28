/**
 * Canonical unit-string normalizer.
 *
 * Single source of truth for the unit alias table and the leading-unit regex,
 * shared by the recipe conversion engine (`recipeUnitConversion`) and the
 * ingredient-density policy (`ingredientConversionPolicy`). Previously each
 * file carried its own near-identical copy, which had already drifted (the
 * policy copy dropped the temperature/mass/length aliases and treated a bare
 * uppercase "C" as cups instead of Celsius).
 */
export function normalizeUnit(unit: string): string {
  if (!unit) {
    return '';
  }

  const normalizedWhitespace = unit.trim().replace(/\s+/g, ' ');
  const lower = normalizedWhitespace.toLowerCase();

  if (normalizedWhitespace === 'T') {
    return 'tbsp';
  }

  if (normalizedWhitespace === 't') {
    return 'tsp';
  }

  if (normalizedWhitespace === 'C' || lower === '°c' || lower === 'celsius') {
    return '°C';
  }

  if (lower === '°f' || lower === 'f' || lower === 'fahrenheit') {
    return '°F';
  }

  const unitMap: Record<string, string> = {
    cups: 'cup',
    cup: 'cup',
    c: 'cup',
    pints: 'pt',
    pint: 'pt',
    pts: 'pt',
    pt: 'pt',
    quarts: 'qt',
    quart: 'qt',
    qts: 'qt',
    qt: 'qt',
    tablespoons: 'tbsp',
    tablespoon: 'tbsp',
    tbsp: 'tbsp',
    teaspons: 'tsp',
    teaspoons: 'tsp',
    teaspoon: 'tsp',
    tsp: 'tsp',
    ounces: 'oz',
    ounce: 'oz',
    oz: 'oz',
    pounds: 'lb',
    pound: 'lb',
    lbs: 'lb',
    lb: 'lb',
    grams: 'g',
    gram: 'g',
    g: 'g',
    kilograms: 'kg',
    kilogram: 'kg',
    kg: 'kg',
    milliliters: 'ml',
    milliliter: 'ml',
    millilitres: 'ml',
    millilitre: 'ml',
    ml: 'ml',
    liters: 'l',
    liter: 'l',
    litres: 'l',
    litre: 'l',
    l: 'l',
    'fluid ounce': 'fl oz',
    'fluid ounces': 'fl oz',
    'fl oz': 'fl oz',
    'fl. oz.': 'fl oz',
    floz: 'fl oz',
    gallons: 'gal',
    gallon: 'gal',
    gal: 'gal',
    inches: 'in',
    inch: 'in',
    in: 'in',
    feet: 'ft',
    foot: 'ft',
    ft: 'ft',
  };

  if (unitMap[lower]) {
    return unitMap[lower];
  }

  const leadingUnit = lower.match(
    /^(cups?|tablespoons?|tbsp|teaspoons?|tsp|quarts?|qts?|pints?|pts?|gallons?|gal|liters?|litres?|l|milliliters?|millilitres?|ml|fluid ounces?|fl\. oz\.|floz)\b/,
  )?.[1];
  if (leadingUnit) {
    return unitMap[leadingUnit] ?? leadingUnit;
  }

  return lower;
}

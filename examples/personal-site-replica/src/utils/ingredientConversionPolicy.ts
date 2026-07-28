import { normalizeUnit } from './unitNormalization';

export type MetricVolumeIngredientClassification =
  | 'metric-mass'
  | 'metric-volume'
  | 'not-volume';

export type MetricMassRuleCategory =
  | 'aromatics'
  | 'dairy'
  | 'fat'
  | 'flour'
  | 'fruit'
  | 'grain'
  | 'legume'
  | 'meat'
  | 'nut'
  | 'powder'
  | 'produce'
  | 'seed'
  | 'spice'
  | 'sweetener'
  | 'condiment';

export type MetricVolumeRuleCategory =
  | 'alcohol'
  | 'broth'
  | 'condiment'
  | 'dairy'
  | 'extract'
  | 'juice'
  | 'oil'
  | 'sauce'
  | 'vinegar'
  | 'water';

export type MetricMassConversionRule = {
  id: string;
  category: MetricMassRuleCategory;
  gramsPerCup: number;
  terms: readonly string[];
  priority?: number;
  note?: string;
};

type MetricVolumeRule = {
  id: string;
  category: MetricVolumeRuleCategory;
  terms: readonly string[];
  priority?: number;
  note?: string;
};

const VOLUME_UNITS = new Set([
  'ml',
  'l',
  'tsp',
  'tbsp',
  'fl oz',
  'cup',
  'pt',
  'qt',
  'gal',
]);

const PRIORITY_RULE = 100;
const OIL_VOLUME_PRIORITY = 90;
const DEFAULT_PRIORITY = 10;

const METRIC_MASS_CONVERSION_RULES: readonly MetricMassConversionRule[] = [
  {
    id: 'syrups-and-honey',
    category: 'sweetener',
    gramsPerCup: 340,
    terms: [
      'honey',
      'syrup',
      'syrups',
      'maple syrup',
      'pure maple syrup',
      'light corn syrup',
      'molasses',
    ],
    priority: PRIORITY_RULE,
    note: 'Runs before herb terms so names like thyme syrup use syrup density.',
  },
  {
    id: 'pastes',
    category: 'condiment',
    gramsPerCup: 260,
    terms: [
      'tomato paste',
      'miso paste',
      'white miso paste',
      'chili paste',
      'red chili paste',
      'korean red chili paste',
      'chile broad bean paste',
      'sichuan chile broad bean paste',
      'sweet bean paste',
      'tianmianjiang sweet bean paste',
      'doubanjiang',
      'gochujang',
      'ginger garlic paste',
      'ginger-garlic paste',
      'bouillon paste',
      'chicken bouillon paste',
    ],
    priority: PRIORITY_RULE,
    note: 'Runs before chili and bouillon powder terms.',
  },
  {
    id: 'bread-flour',
    category: 'flour',
    gramsPerCup: 127,
    terms: ['bread flour', 'unbleached bread flour'],
  },
  {
    id: 'whole-wheat-flour',
    category: 'flour',
    gramsPerCup: 113,
    terms: ['whole wheat flour'],
  },
  {
    id: 'rye-flour',
    category: 'flour',
    gramsPerCup: 102,
    terms: ['rye flour', 'pumpernickel flour', 'white rye flour'],
  },
  {
    id: 'buckwheat-and-white-flour',
    category: 'flour',
    gramsPerCup: 120,
    terms: ['buckwheat flour', 'white flour', 'unbleached white flour'],
  },
  {
    id: 'potato-flour',
    category: 'flour',
    gramsPerCup: 160,
    terms: ['potato flour', 'sweet potato flour'],
  },
  {
    id: 'chickpea-flour',
    category: 'flour',
    gramsPerCup: 92,
    terms: ['chickpea flour', 'besan flour', 'mochiko flour'],
  },
  {
    id: 'atta-flour',
    category: 'flour',
    gramsPerCup: 120,
    terms: ['chakki atta', 'atta'],
  },
  {
    id: 'semolina',
    category: 'flour',
    gramsPerCup: 167,
    terms: ['semolina flour', 'semolina'],
  },
  {
    id: 'generic-flour',
    category: 'flour',
    gramsPerCup: 120,
    terms: [
      'all purpose flour',
      'all-purpose flour',
      'ap flour',
      'plain flour',
      'unbleached flour',
      'pizza flour',
      'flour',
    ],
  },
  {
    id: 'cornstarch',
    category: 'powder',
    gramsPerCup: 128,
    terms: ['cornstarch', 'corn starch'],
  },
  {
    id: 'cornmeal',
    category: 'grain',
    gramsPerCup: 160,
    terms: ['cornmeal'],
  },
  {
    id: 'breadcrumbs',
    category: 'grain',
    gramsPerCup: 60,
    terms: [
      'breadcrumb',
      'breadcrumbs',
      'bread crumb',
      'bread crumbs',
      'panko',
    ],
  },
  {
    id: 'oats',
    category: 'grain',
    gramsPerCup: 80,
    terms: [
      'rolled oats',
      'old-fashioned rolled oats',
      'whole rolled oats',
      'oats',
      'oatmeal',
    ],
  },
  {
    id: 'dried-potato-flakes',
    category: 'produce',
    gramsPerCup: 60,
    terms: ['dried potato flakes'],
  },
  {
    id: 'brown-sugar',
    category: 'sweetener',
    gramsPerCup: 213,
    terms: ['brown sugar', 'light brown sugar', 'dark brown sugar'],
  },
  {
    id: 'powdered-sugar',
    category: 'sweetener',
    gramsPerCup: 120,
    terms: ['powdered sugar', 'confectioners sugar', "confectioners' sugar"],
  },
  {
    id: 'granulated-sugar',
    category: 'sweetener',
    gramsPerCup: 200,
    terms: [
      'granulated sugar',
      'white sugar',
      'caster sugar',
      'maple sugar',
      'cinnamon sugar',
      'sugar',
    ],
  },
  {
    id: 'salt',
    category: 'spice',
    gramsPerCup: 288,
    terms: [
      'diamond crystal kosher salt',
      'kosher salt',
      'table salt',
      'fine sea salt',
      'sea salt',
      'coarse sea salt',
      'coarse salt',
      'flaky sea salt',
      'flaky salt',
      'hawaiian sea salt',
      'seasoned salt',
      'cheese salt',
      'salt',
    ],
  },
  {
    id: 'leaveners-and-yeast',
    category: 'powder',
    gramsPerCup: 192,
    terms: ['baking powder'],
  },
  {
    id: 'baking-soda',
    category: 'powder',
    gramsPerCup: 220,
    terms: ['baking soda'],
  },
  {
    id: 'yeast',
    category: 'powder',
    gramsPerCup: 149,
    terms: ['instant yeast', 'active dry yeast', 'dry yeast', 'yeast'],
  },
  {
    id: 'dry-milk',
    category: 'powder',
    gramsPerCup: 68,
    terms: ['dry milk', 'nonfat dry milk', 'milk powder', 'powdered milk'],
    priority: PRIORITY_RULE,
  },
  {
    id: 'cocoa-and-savory-powders',
    category: 'powder',
    gramsPerCup: 85,
    terms: [
      'cocoa powder',
      'black cocoa',
      'unsweetened cocoa powder',
      'espresso powder',
      'malted milk powder',
      'cheese powder',
      'diastatic malt powder',
      'dashi powder',
      'bouillon powder',
      'bouillon',
    ],
    priority: PRIORITY_RULE,
  },
  {
    id: 'ground-spices',
    category: 'spice',
    gramsPerCup: 96,
    terms: [
      'paprika',
      'chili',
      'chilli',
      'chipotle',
      'cayenne',
      'cumin',
      'fennel',
      'coriander',
      'turmeric',
      'cinnamon',
      'nutmeg',
      'clove',
      'cloves',
      'allspice',
      'sumac',
      'garam masala',
      'chaat masala',
      'cajun seasoning',
      'blackening seasoning',
      'italian seasoning',
      'pizza seasoning',
      'spicy seasoning mix',
      'five-spice',
      'five spice',
      'curry powder',
      'white pepper',
      'black pepper',
      'pepper',
      'garlic powder',
      'onion powder',
      'granulated garlic',
      'achiote powder',
      'citric acid',
      'msg',
    ],
  },
  {
    id: 'herbs',
    category: 'spice',
    gramsPerCup: 24,
    terms: [
      'dried herbs',
      'fresh herbs',
      'fresh chopped herbs',
      'oregano',
      'basil',
      'thyme',
      'parsley',
      'rosemary',
      'fenugreek',
      'methi',
      'mint leaves',
    ],
  },
  {
    id: 'cardamom',
    category: 'spice',
    gramsPerCup: 96,
    terms: ['cardamom'],
  },
  {
    id: 'specialty-powders',
    category: 'powder',
    gramsPerCup: 120,
    terms: [
      'farina',
      'psyllium husk',
      'easy roll dough improver',
      'pizza dough flavor',
      'deli rye flavor',
      'lemon juice powder',
    ],
  },
  {
    id: 'sesame-seeds',
    category: 'seed',
    gramsPerCup: 144,
    terms: [
      'sesame seed',
      'sesame seeds',
      'white sesame seeds',
      'toasted sesame seeds',
    ],
  },
  {
    id: 'chia-seeds',
    category: 'seed',
    gramsPerCup: 168,
    terms: ['chia seed', 'chia seeds'],
  },
  {
    id: 'poppy-seeds',
    category: 'seed',
    gramsPerCup: 145,
    terms: ['poppy seed', 'poppy seeds'],
  },
  {
    id: 'mustard-seeds',
    category: 'seed',
    gramsPerCup: 144,
    terms: [
      'mustard seed',
      'mustard seeds',
      'black mustard seed',
      'black mustard seeds',
      'yellow mustard seed',
    ],
  },
  {
    id: 'whole-spice-seeds',
    category: 'seed',
    gramsPerCup: 96,
    terms: [
      'cumin seed',
      'cumin seeds',
      'coriander seed',
      'coriander seeds',
      'fennel seed',
      'fennel seeds',
      'dill seed',
      'dill seeds',
      'caraway seed',
      'caraway seeds',
      'peppercorn',
      'peppercorns',
      'sichuan peppercorn',
      'sichuan peppercorns',
    ],
  },
  {
    id: 'walnuts',
    category: 'nut',
    gramsPerCup: 117,
    terms: ['walnut', 'walnuts', 'chopped walnuts', 'toasted walnuts'],
  },
  {
    id: 'pecans',
    category: 'nut',
    gramsPerCup: 109,
    terms: ['pecan', 'pecans', 'chopped pecans'],
  },
  {
    id: 'almonds',
    category: 'nut',
    gramsPerCup: 143,
    terms: ['almond', 'almonds', 'slivered almonds', 'whole almonds'],
  },
  {
    id: 'cashews',
    category: 'nut',
    gramsPerCup: 137,
    terms: ['cashew', 'cashews', 'unsalted cashews'],
  },
  {
    id: 'peanuts-and-pine-nuts',
    category: 'nut',
    gramsPerCup: 135,
    terms: ['peanut', 'peanuts', 'roasted peanuts', 'pine nut', 'pine nuts'],
  },
  {
    id: 'pepitas-and-seeds',
    category: 'seed',
    gramsPerCup: 129,
    terms: [
      'pepita',
      'pepitas',
      'pumpkin seed',
      'pumpkin seeds',
      'sunflower seed',
      'sunflower seeds',
    ],
  },
  {
    id: 'chocolate-chips',
    category: 'sweetener',
    gramsPerCup: 170,
    terms: ['chocolate chip', 'chocolate chips'],
  },
  {
    id: 'coconut-flakes',
    category: 'nut',
    gramsPerCup: 80,
    terms: ['coconut flake', 'coconut flakes'],
  },
  {
    id: 'granola-and-crunchy-noodles',
    category: 'grain',
    gramsPerCup: 60,
    terms: ['granola', 'crunchy noodles'],
  },
  {
    id: 'uncooked-rice',
    category: 'grain',
    gramsPerCup: 185,
    terms: [
      'long-grain rice',
      'long grain rice',
      'long grain white rice',
      'sushi rice',
    ],
  },
  {
    id: 'cooked-rice',
    category: 'grain',
    gramsPerCup: 158,
    terms: ['cooked rice', 'hot cooked rice', 'steamed rice'],
  },
  {
    id: 'lentils',
    category: 'legume',
    gramsPerCup: 200,
    terms: [
      'dried lentil',
      'dried lentils',
      'split yellow lentils',
      'split skinned black gram lentils',
      'whole black lentils',
    ],
  },
  {
    id: 'beans',
    category: 'legume',
    gramsPerCup: 177,
    terms: [
      'dried cannellini bean',
      'dried cannellini beans',
      'dry pinto bean',
      'dry pinto beans',
      'pinto bean',
      'pinto beans',
      'red kidney bean',
      'red kidney beans',
    ],
  },
  {
    id: 'butter',
    category: 'fat',
    gramsPerCup: 227,
    terms: ['unsalted butter', 'salted butter', 'melted butter', 'butter'],
  },
  {
    id: 'shortening',
    category: 'fat',
    gramsPerCup: 205,
    terms: ['shortening'],
  },
  {
    id: 'ghee-and-fat',
    category: 'fat',
    gramsPerCup: 218,
    terms: ['ghee', 'fat', 'bacon fat'],
  },
  {
    id: 'parmesan',
    category: 'dairy',
    gramsPerCup: 100,
    terms: [
      'parmesan cheese',
      'parmigiano-reggiano cheese',
      'grated parmesan cheese',
    ],
  },
  {
    id: 'cheese-and-tofu',
    category: 'dairy',
    gramsPerCup: 113,
    terms: [
      'cheddar cheese',
      'sharp cheddar cheese',
      'jack cheese',
      'pepper jack cheese',
      'mozzarella cheese',
      'shredded mozzarella cheese',
      'gruyere cheese',
      'feta cheese',
      'paneer',
      'queso fresco',
      'tofu',
    ],
  },
  {
    id: 'spoonable-dairy',
    category: 'dairy',
    gramsPerCup: 240,
    terms: [
      'sour cream',
      'greek yogurt',
      'plain greek yogurt',
      'plain yogurt',
      'natural yogurt',
      'yogurt',
      'kefir',
    ],
    priority: PRIORITY_RULE,
  },
  {
    id: 'sourdough-starter',
    category: 'grain',
    gramsPerCup: 227,
    terms: ['sourdough starter'],
  },
  {
    id: 'purees-and-preserves',
    category: 'produce',
    gramsPerCup: 240,
    terms: ['tomato puree', 'pumpkin puree', 'applesauce', 'fruit preserves'],
  },
  {
    id: 'mayonnaise',
    category: 'condiment',
    gramsPerCup: 220,
    terms: ['mayonnaise', 'mayo'],
  },
  {
    id: 'onions',
    category: 'aromatics',
    gramsPerCup: 160,
    terms: [
      'yellow onion',
      'red onion',
      'onion',
      'onions',
      'minced onion',
      'grated red onion',
    ],
  },
  {
    id: 'scallions-and-chives',
    category: 'aromatics',
    gramsPerCup: 100,
    terms: [
      'scallion',
      'scallions',
      'chive',
      'chives',
      'chinese garlic chives',
    ],
  },
  {
    id: 'garlic',
    category: 'aromatics',
    gramsPerCup: 136,
    terms: [
      'garlic',
      'minced garlic',
      'grated garlic',
      'peeled garlic cloves',
      'chopped garlic',
    ],
  },
  {
    id: 'ginger',
    category: 'aromatics',
    gramsPerCup: 96,
    terms: [
      'ginger',
      'fresh ginger',
      'grated ginger',
      'minced ginger',
      'chopped ginger',
      'minced fresh ginger',
    ],
  },
  {
    id: 'cilantro',
    category: 'produce',
    gramsPerCup: 16,
    terms: ['cilantro'],
  },
  {
    id: 'fresh-parsley',
    category: 'produce',
    gramsPerCup: 60,
    terms: ['parsley'],
  },
  {
    id: 'fresh-basil',
    category: 'produce',
    gramsPerCup: 24,
    terms: ['basil'],
  },
  {
    id: 'fresh-thyme-and-rosemary',
    category: 'produce',
    gramsPerCup: 32,
    terms: ['thyme leaves', 'fresh thyme leaves', 'rosemary'],
  },
  {
    id: 'leafy-greens',
    category: 'produce',
    gramsPerCup: 67,
    terms: ['kale'],
  },
  {
    id: 'spinach',
    category: 'produce',
    gramsPerCup: 30,
    terms: ['spinach'],
  },
  {
    id: 'lettuce',
    category: 'produce',
    gramsPerCup: 36,
    terms: ['shredded iceberg lettuce', 'shredded lettuce'],
  },
  {
    id: 'sprouts',
    category: 'produce',
    gramsPerCup: 104,
    terms: ['bean sprouts'],
  },
  {
    id: 'bamboo-shoots-and-water-chestnuts',
    category: 'produce',
    gramsPerCup: 140,
    terms: ['bamboo shoots', 'water chestnuts'],
  },
  {
    id: 'zucchini',
    category: 'produce',
    gramsPerCup: 124,
    terms: ['grated zucchini'],
  },
  {
    id: 'fruit',
    category: 'fruit',
    gramsPerCup: 165,
    terms: [
      'apples',
      'blueberries',
      'mixed fruit',
      'frozen fruit',
      'fresh tropical fruit',
      'frozen mixed berries',
      'frozen pineapple chunks',
      'mango',
      'frozen mango',
      'frozen mango chunks',
      'raisins',
    ],
  },
  {
    id: 'zest',
    category: 'fruit',
    gramsPerCup: 96,
    terms: ['lemon zest', 'lime zest', 'orange zest'],
  },
  {
    id: 'tomatoes',
    category: 'produce',
    gramsPerCup: 180,
    terms: ['tomatoes', 'cherry tomatoes', 'sundried tomatoes'],
  },
  {
    id: 'bell-pepper',
    category: 'produce',
    gramsPerCup: 149,
    terms: ['bell pepper', 'diced red bell pepper'],
  },
  {
    id: 'banana-peppers',
    category: 'produce',
    gramsPerCup: 150,
    terms: ['banana pepper rings', 'banana peppers'],
  },
  {
    id: 'olives',
    category: 'produce',
    gramsPerCup: 135,
    terms: ['kalamata olives'],
  },
  {
    id: 'capers-pickled-chiles-and-ice',
    category: 'produce',
    gramsPerCup: 135,
    terms: ['capers', 'pickled chiles', 'ice cubes'],
  },
  {
    id: 'mixed-produce',
    category: 'produce',
    gramsPerCup: 120,
    terms: [
      'carrot',
      'celery',
      'shallots',
      'vegetables',
      'cabbage',
      'broccoli florets',
      'frozen corn',
      'frozen peas and carrots',
      'mushrooms',
      'fresh mushrooms',
      'greens',
    ],
  },
  {
    id: 'potatoes',
    category: 'produce',
    gramsPerCup: 210,
    terms: ['mashed potatoes', 'cooked potato'],
  },
  {
    id: 'cooked-meats',
    category: 'meat',
    gramsPerCup: 140,
    terms: [
      'bacon',
      'chinese roast pork',
      'fried pork belly',
      'cooked chicken',
      'rotisserie chicken',
      'pepperoni',
    ],
  },
];

const METRIC_VOLUME_RULES: readonly MetricVolumeRule[] = [
  {
    id: 'oils',
    category: 'oil',
    terms: ['oil', 'oils'],
    priority: OIL_VOLUME_PRIORITY,
    note: 'Oil terms beat ghee/fat mass terms in alternatives like oil or ghee.',
  },
  {
    id: 'water',
    category: 'water',
    terms: ['water'],
  },
  {
    id: 'broths-and-stocks',
    category: 'broth',
    terms: ['stock', 'broth', 'dashi'],
  },
  {
    id: 'dairy-liquids',
    category: 'dairy',
    terms: ['milk', 'oatmilk', 'buttermilk', 'cream', 'half and half'],
    priority: 80,
  },
  {
    id: 'juices-and-brines',
    category: 'juice',
    terms: ['juice', 'pickle juice', 'pickling liquid', 'brine', 'liquid'],
  },
  {
    id: 'vinegars',
    category: 'vinegar',
    terms: ['vinegar'],
  },
  {
    id: 'alcohol',
    category: 'alcohol',
    terms: ['wine', 'mirin', 'sake', 'rum', 'sherry'],
  },
  {
    id: 'sauces-and-condiments',
    category: 'sauce',
    terms: [
      'sauce',
      'sriracha',
      'ketchup',
      'mustard',
      'chutney',
      'marinara',
      'vinaigrette',
    ],
  },
  {
    id: 'extracts-and-flavorings',
    category: 'extract',
    terms: ['vanilla', 'extract', 'smoke', 'maple flavor'],
  },
  {
    id: 'batters',
    category: 'condiment',
    terms: ['batter'],
  },
];

export function classifyMetricVolumeIngredient(
  name: string,
  unit: string,
): MetricVolumeIngredientClassification {
  if (!isPolicyVolumeUnit(unit)) {
    return 'not-volume';
  }

  const massRule = getMetricVolumeIngredientMassRule(name, unit);
  const volumeRule = findBestRule(name, METRIC_VOLUME_RULES);

  if (
    massRule &&
    (!volumeRule || rulePriority(massRule) >= rulePriority(volumeRule))
  ) {
    return 'metric-mass';
  }

  if (volumeRule) {
    return 'metric-volume';
  }

  return 'not-volume';
}

export function getMetricVolumeIngredientMassRule(
  name: string,
  unit: string,
): MetricMassConversionRule | null {
  if (!isPolicyVolumeUnit(unit)) {
    return null;
  }

  const massRule = findBestRule(name, METRIC_MASS_CONVERSION_RULES);
  const volumeRule = findBestRule(name, METRIC_VOLUME_RULES);

  if (!massRule) {
    return null;
  }

  if (volumeRule && rulePriority(volumeRule) > rulePriority(massRule)) {
    return null;
  }

  return massRule;
}

function isPolicyVolumeUnit(unit: string): boolean {
  return VOLUME_UNITS.has(normalizeUnit(unit));
}

function findBestRule<
  T extends { terms: readonly string[]; priority?: number },
>(name: string, rules: readonly T[]): T | null {
  const normalizedName = normalizeIngredientName(name);
  let best: T | null = null;

  for (const rule of rules) {
    if (!rule.terms.some((term) => termMatches(normalizedName, term))) {
      continue;
    }

    if (!best || rulePriority(rule) > rulePriority(best)) {
      best = rule;
    }
  }

  return best;
}

function rulePriority(rule: { priority?: number }): number {
  return rule.priority ?? DEFAULT_PRIORITY;
}

function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u2010\u2011\u2012\u2013\u2014-]/g, ' ')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function termMatches(normalizedName: string, term: string): boolean {
  const normalizedTerm = normalizeIngredientName(term);
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(normalizedName);
}

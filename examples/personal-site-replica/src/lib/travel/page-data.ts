import {
  getChinaProvinceMeta,
  normalizeChinaProvinceCode,
} from './china-provinces';

export type TravelCityInput = {
  id: string;
  name: string;
  countryCode: string;
  stateCode?: string;
  provinceCode?: string;
  gps: { lat: number; lng: number };
  firstVisited?: Date;
  tags?: string[];
};

export type TravelCollectionData = {
  name?: string;
  description?: string;
  visitedCountries?: string[];
  visitedUsStates?: string[];
  visitedChinaProvinces?: string[];
  cities?: TravelCityInput[];
};

export type NormalizedTravelCity = {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  countryNumericId: string;
  countryRegion: string;
  countrySubregion: string;
  stateCode?: string;
  stateName?: string;
  stateFips?: string;
  provinceCode?: string;
  provinceName?: string;
  provinceAdminCode?: string;
  gps: { lat: number; lng: number };
  firstVisited?: Date;
  tags: string[];
};

export type TravelCountrySummary = {
  code: string;
  name: string;
  numericId: string;
  region: string;
  subregion: string;
  cityCount: number;
};

export type TravelStateSummary = {
  code: string;
  name: string;
  fips: string;
  cityCount: number;
};

export type TravelChinaProvinceSummary = {
  code: string;
  name: string;
  adminCode: string;
  cityCount: number;
};

export type TravelMapCity = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
};

export type TravelMapPayload = {
  highlightedCountryIds: string[];
  highlightedStateIds: string[];
  highlightedChinaProvinceIds: string[];
  cities: TravelMapCity[];
};

export type TravelCountrySection = TravelCountrySummary & {
  cities: NormalizedTravelCity[];
};

export type TravelCityGroup = {
  id: string;
  label: string;
  meta?: string;
  cities: NormalizedTravelCity[];
  cityNames: string;
};

export type TravelDisplayCountrySection = TravelCountrySection & {
  cityList: string;
  subdivisionGroups: TravelCityGroup[];
  subdivisionLabel?: string;
};

export type TravelRegionGroup = {
  cityCount: number;
  countries: TravelDisplayCountrySection[];
  name: string;
  slug: string;
};

export type TravelPageData = {
  collectionName: string;
  collectionDescription: string;
  cities: NormalizedTravelCity[];
  countries: TravelCountrySummary[];
  countrySections: TravelCountrySection[];
  cityRegionGroups: TravelRegionGroup[];
  usStates: TravelStateSummary[];
  chinaProvinces: TravelChinaProvinceSummary[];
  map: TravelMapPayload;
  stats: {
    cityCount: number;
    countryCount: number;
    usStateCount: number;
    chinaProvinceCount: number;
  };
};

const US_COUNTRY_CODE = 'US';
const CHINA_COUNTRY_CODE = 'CN';
const REGION_ORDER = [
  'North America',
  'Central America',
  'South America',
  'Europe',
  'East Asia',
  'Southeast Asia',
  'Central Asia',
  'South Asia',
  'Western Asia',
  'Oceania',
  'Africa',
  'Other',
];

const SUBREGION_LABELS: Record<string, string> = {
  'Eastern Asia': 'East Asia',
  'South-Eastern Asia': 'Southeast Asia',
};

export const US_STATE_META = {
  AL: { fips: '01', name: 'Alabama' },
  AK: { fips: '02', name: 'Alaska' },
  AZ: { fips: '04', name: 'Arizona' },
  AR: { fips: '05', name: 'Arkansas' },
  CA: { fips: '06', name: 'California' },
  CO: { fips: '08', name: 'Colorado' },
  CT: { fips: '09', name: 'Connecticut' },
  DE: { fips: '10', name: 'Delaware' },
  DC: { fips: '11', name: 'District of Columbia' },
  FL: { fips: '12', name: 'Florida' },
  GA: { fips: '13', name: 'Georgia' },
  HI: { fips: '15', name: 'Hawaii' },
  ID: { fips: '16', name: 'Idaho' },
  IL: { fips: '17', name: 'Illinois' },
  IN: { fips: '18', name: 'Indiana' },
  IA: { fips: '19', name: 'Iowa' },
  KS: { fips: '20', name: 'Kansas' },
  KY: { fips: '21', name: 'Kentucky' },
  LA: { fips: '22', name: 'Louisiana' },
  ME: { fips: '23', name: 'Maine' },
  MD: { fips: '24', name: 'Maryland' },
  MA: { fips: '25', name: 'Massachusetts' },
  MI: { fips: '26', name: 'Michigan' },
  MN: { fips: '27', name: 'Minnesota' },
  MS: { fips: '28', name: 'Mississippi' },
  MO: { fips: '29', name: 'Missouri' },
  MT: { fips: '30', name: 'Montana' },
  NE: { fips: '31', name: 'Nebraska' },
  NV: { fips: '32', name: 'Nevada' },
  NH: { fips: '33', name: 'New Hampshire' },
  NJ: { fips: '34', name: 'New Jersey' },
  NM: { fips: '35', name: 'New Mexico' },
  NY: { fips: '36', name: 'New York' },
  NC: { fips: '37', name: 'North Carolina' },
  ND: { fips: '38', name: 'North Dakota' },
  OH: { fips: '39', name: 'Ohio' },
  OK: { fips: '40', name: 'Oklahoma' },
  OR: { fips: '41', name: 'Oregon' },
  PA: { fips: '42', name: 'Pennsylvania' },
  RI: { fips: '44', name: 'Rhode Island' },
  SC: { fips: '45', name: 'South Carolina' },
  SD: { fips: '46', name: 'South Dakota' },
  TN: { fips: '47', name: 'Tennessee' },
  TX: { fips: '48', name: 'Texas' },
  UT: { fips: '49', name: 'Utah' },
  VT: { fips: '50', name: 'Vermont' },
  VA: { fips: '51', name: 'Virginia' },
  WA: { fips: '53', name: 'Washington' },
  WV: { fips: '54', name: 'West Virginia' },
  WI: { fips: '55', name: 'Wisconsin' },
  WY: { fips: '56', name: 'Wyoming' },
  AS: { fips: '60', name: 'American Samoa' },
  GU: { fips: '66', name: 'Guam' },
  MP: { fips: '69', name: 'Northern Mariana Islands' },
  PR: { fips: '72', name: 'Puerto Rico' },
  VI: { fips: '78', name: 'United States Virgin Islands' },
} as const;

type USStateMeta = (typeof US_STATE_META)[keyof typeof US_STATE_META];
const US_STATE_LOOKUP = US_STATE_META as Record<string, USStateMeta>;

type CountryMeta = {
  name: string;
  numericId: string;
  region: string;
  subregion: string;
};

// This is the canonical country metadata used by the current travel
// collection. Keeping the display data beside the travel feature avoids
// shipping the entire world-countries catalog to this static replica.
const COUNTRY_META: Record<string, CountryMeta> = {
  AT: { name: 'Austria', numericId: '040', region: 'Europe', subregion: 'Central Europe' },
  CA: { name: 'Canada', numericId: '124', region: 'Americas', subregion: 'North America' },
  CN: { name: 'China', numericId: '156', region: 'Asia', subregion: 'Eastern Asia' },
  CO: { name: 'Colombia', numericId: '170', region: 'Americas', subregion: 'South America' },
  CR: { name: 'Costa Rica', numericId: '188', region: 'Americas', subregion: 'Central America' },
  DE: { name: 'Germany', numericId: '276', region: 'Europe', subregion: 'Western Europe' },
  DK: { name: 'Denmark', numericId: '208', region: 'Europe', subregion: 'Northern Europe' },
  EE: { name: 'Estonia', numericId: '233', region: 'Europe', subregion: 'Northern Europe' },
  ES: { name: 'Spain', numericId: '724', region: 'Europe', subregion: 'Southern Europe' },
  FI: { name: 'Finland', numericId: '246', region: 'Europe', subregion: 'Northern Europe' },
  FR: { name: 'France', numericId: '250', region: 'Europe', subregion: 'Western Europe' },
  GB: { name: 'United Kingdom', numericId: '826', region: 'Europe', subregion: 'Northern Europe' },
  HR: { name: 'Croatia', numericId: '191', region: 'Europe', subregion: 'Southeast Europe' },
  IS: { name: 'Iceland', numericId: '352', region: 'Europe', subregion: 'Northern Europe' },
  IT: { name: 'Italy', numericId: '380', region: 'Europe', subregion: 'Southern Europe' },
  JP: { name: 'Japan', numericId: '392', region: 'Asia', subregion: 'Eastern Asia' },
  LA: { name: 'Laos', numericId: '418', region: 'Asia', subregion: 'South-Eastern Asia' },
  LU: { name: 'Luxembourg', numericId: '442', region: 'Europe', subregion: 'Western Europe' },
  MC: { name: 'Monaco', numericId: '492', region: 'Europe', subregion: 'Western Europe' },
  MM: { name: 'Myanmar', numericId: '104', region: 'Asia', subregion: 'South-Eastern Asia' },
  MT: { name: 'Malta', numericId: '470', region: 'Europe', subregion: 'Southern Europe' },
  MX: { name: 'Mexico', numericId: '484', region: 'Americas', subregion: 'North America' },
  NI: { name: 'Nicaragua', numericId: '558', region: 'Americas', subregion: 'Central America' },
  NO: { name: 'Norway', numericId: '578', region: 'Europe', subregion: 'Northern Europe' },
  PL: { name: 'Poland', numericId: '616', region: 'Europe', subregion: 'Central Europe' },
  PT: { name: 'Portugal', numericId: '620', region: 'Europe', subregion: 'Southern Europe' },
  SE: { name: 'Sweden', numericId: '752', region: 'Europe', subregion: 'Northern Europe' },
  TH: { name: 'Thailand', numericId: '764', region: 'Asia', subregion: 'South-Eastern Asia' },
  US: { name: 'United States', numericId: '840', region: 'Americas', subregion: 'North America' },
  VN: { name: 'Vietnam', numericId: '704', region: 'Asia', subregion: 'South-Eastern Asia' },
};

const COUNTRY_BY_CODE = new Map(Object.entries(COUNTRY_META));

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s/\\_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function compareByName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name);
}

function normalizeCountryCode(code: string): string {
  return code.trim().toUpperCase();
}

function normalizeStateCode(code: string | undefined): string | undefined {
  const normalized = code?.trim().toUpperCase();
  return normalized || undefined;
}

function getStateMeta(code: string) {
  return US_STATE_LOOKUP[code];
}

function requireCountry(code: string) {
  const country = COUNTRY_BY_CODE.get(code);
  if (!country?.numericId) {
    throw new Error(`Unknown travel countryCode "${code}".`);
  }
  return country;
}

function normalizeCountryCodes(codes: string[] = []): string[] {
  const seenCodes = new Set<string>();

  return codes.map(normalizeCountryCode).filter((code) => {
    requireCountry(code);
    if (seenCodes.has(code)) return false;
    seenCodes.add(code);
    return true;
  });
}

function normalizeStateCodes(codes: string[] = []): string[] {
  const seenCodes = new Set<string>();

  return codes
    .map((code) => normalizeStateCode(code) ?? '')
    .filter((code) => {
      const stateMeta = getStateMeta(code);
      if (!stateMeta) {
        throw new Error(`Unknown US stateCode "${code}".`);
      }
      if (seenCodes.has(code)) return false;
      seenCodes.add(code);
      return true;
    });
}

function normalizeChinaProvinceCodes(codes: string[] = []): string[] {
  const seenCodes = new Set<string>();

  return codes
    .map((code) => normalizeChinaProvinceCode(code) ?? '')
    .filter((code) => {
      const provinceMeta = getChinaProvinceMeta(code);
      if (!provinceMeta) {
        throw new Error(`Unknown China provinceCode "${code}".`);
      }
      if (seenCodes.has(code)) return false;
      seenCodes.add(code);
      return true;
    });
}

function normalizeTravelCity(city: TravelCityInput): NormalizedTravelCity {
  const countryCode = normalizeCountryCode(city.countryCode);
  const country = requireCountry(countryCode);
  const stateCode = normalizeStateCode(city.stateCode);
  const provinceCode = normalizeChinaProvinceCode(city.provinceCode);

  if (countryCode === US_COUNTRY_CODE && !stateCode) {
    throw new Error(`US travel city "${city.id}" must include stateCode.`);
  }

  if (countryCode !== US_COUNTRY_CODE && stateCode) {
    throw new Error(`Non-US travel city "${city.id}" must not set stateCode.`);
  }

  if (countryCode === CHINA_COUNTRY_CODE && !provinceCode) {
    throw new Error(
      `China travel city "${city.id}" must include provinceCode.`,
    );
  }

  if (countryCode !== CHINA_COUNTRY_CODE && provinceCode) {
    throw new Error(
      `Non-China travel city "${city.id}" must not set provinceCode.`,
    );
  }

  const stateMeta = stateCode ? getStateMeta(stateCode) : undefined;
  if (stateCode && !stateMeta) {
    throw new Error(`Unknown US stateCode "${stateCode}" for "${city.id}".`);
  }

  const provinceMeta = provinceCode
    ? getChinaProvinceMeta(provinceCode)
    : undefined;
  if (provinceCode && !provinceMeta) {
    throw new Error(
      `Unknown China provinceCode "${provinceCode}" for "${city.id}".`,
    );
  }

  return {
    id: city.id,
    name: city.name,
    countryCode,
    countryName: country.name,
    countryNumericId: country.numericId,
    countryRegion: country.region,
    countrySubregion: country.subregion,
    stateCode,
    stateName: stateMeta?.name,
    stateFips: stateMeta?.fips,
    provinceCode,
    provinceName: provinceMeta?.name,
    provinceAdminCode: provinceMeta?.adminCode,
    gps: city.gps,
    firstVisited: city.firstVisited,
    tags: city.tags ?? [],
  };
}

export function normalizeTravelCities(
  cities: TravelCityInput[] = [],
): NormalizedTravelCity[] {
  const seenIds = new Set<string>();

  return cities
    .map((city) => {
      if (seenIds.has(city.id)) {
        throw new Error(`Duplicate travel city id "${city.id}".`);
      }
      seenIds.add(city.id);
      return normalizeTravelCity(city);
    })
    .sort((a, b) => {
      const country = a.countryName.localeCompare(b.countryName);
      if (country !== 0) return country;
      const state = (a.stateName ?? '').localeCompare(b.stateName ?? '');
      if (state !== 0) return state;
      return a.name.localeCompare(b.name);
    });
}

export function buildTravelCountries(
  cities: NormalizedTravelCity[],
  visitedCountryCodes: string[] = [],
): TravelCountrySummary[] {
  const summaries = new Map<string, TravelCountrySummary>();

  for (const code of normalizeCountryCodes(visitedCountryCodes)) {
    const country = requireCountry(code);
    summaries.set(code, {
      code,
      name: country.name,
      numericId: country.numericId,
      region: country.region,
      subregion: country.subregion,
      cityCount: 0,
    });
  }

  for (const city of cities) {
    const existing = summaries.get(city.countryCode);
    if (existing) {
      existing.cityCount += 1;
      continue;
    }
    summaries.set(city.countryCode, {
      code: city.countryCode,
      name: city.countryName,
      numericId: city.countryNumericId,
      region: city.countryRegion,
      subregion: city.countrySubregion,
      cityCount: 1,
    });
  }

  return [...summaries.values()].sort(compareByName);
}

export function buildTravelUsStates(
  cities: NormalizedTravelCity[],
  visitedStateCodes: string[] = [],
): TravelStateSummary[] {
  const summaries = new Map<string, TravelStateSummary>();

  for (const code of normalizeStateCodes(visitedStateCodes)) {
    const stateMeta = getStateMeta(code);
    summaries.set(code, {
      code,
      name: stateMeta.name,
      fips: stateMeta.fips,
      cityCount: 0,
    });
  }

  for (const city of cities) {
    if (city.countryCode !== US_COUNTRY_CODE || !city.stateCode) continue;

    const existing = summaries.get(city.stateCode);
    if (existing) {
      existing.cityCount += 1;
      continue;
    }
    summaries.set(city.stateCode, {
      code: city.stateCode,
      name: city.stateName ?? city.stateCode,
      fips: city.stateFips ?? '',
      cityCount: 1,
    });
  }

  return [...summaries.values()].sort(compareByName);
}

export function buildTravelChinaProvinces(
  cities: NormalizedTravelCity[],
  visitedProvinceCodes: string[] = [],
): TravelChinaProvinceSummary[] {
  const summaries = new Map<string, TravelChinaProvinceSummary>();

  for (const code of normalizeChinaProvinceCodes(visitedProvinceCodes)) {
    const provinceMeta = getChinaProvinceMeta(code);
    if (!provinceMeta) {
      throw new Error(`Unknown China provinceCode "${code}".`);
    }
    summaries.set(code, {
      code,
      name: provinceMeta.name,
      adminCode: provinceMeta.adminCode,
      cityCount: 0,
    });
  }

  for (const city of cities) {
    if (city.countryCode !== CHINA_COUNTRY_CODE || !city.provinceCode) {
      continue;
    }

    const existing = summaries.get(city.provinceCode);
    if (existing) {
      existing.cityCount += 1;
      continue;
    }
    summaries.set(city.provinceCode, {
      code: city.provinceCode,
      name: city.provinceName ?? city.provinceCode,
      adminCode: city.provinceAdminCode ?? '',
      cityCount: 1,
    });
  }

  return [...summaries.values()].sort(compareByName);
}

export function buildTravelMapPayload(
  cities: NormalizedTravelCity[],
  countries: TravelCountrySummary[],
  usStates: TravelStateSummary[],
  chinaProvinces: TravelChinaProvinceSummary[] = [],
): TravelMapPayload {
  return {
    highlightedCountryIds: countries
      .filter(
        (country) =>
          country.code !== US_COUNTRY_CODE &&
          country.code !== CHINA_COUNTRY_CODE,
      )
      .map((country) => country.numericId),
    highlightedStateIds: usStates.map((state) => state.fips),
    highlightedChinaProvinceIds: chinaProvinces.map(
      (province) => province.adminCode,
    ),
    cities: cities.map((city) => ({
      id: city.id,
      name: travelCityDisplayName(city),
      region:
        city.stateName || city.provinceName
          ? `${city.stateName ?? city.provinceName}, ${city.countryName}`
          : city.countryName,
      lat: city.gps.lat,
      lng: city.gps.lng,
    })),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function travelCityDisplayName(city: NormalizedTravelCity): string {
  const subdivisionNames = [
    city.stateName,
    city.stateCode,
    city.provinceName,
    city.provinceCode,
  ].filter((value): value is string => Boolean(value));

  for (const subdivision of subdivisionNames) {
    const suffix = new RegExp(`,\\s*${escapeRegExp(subdivision)}$`, 'i');
    if (suffix.test(city.name)) return city.name.replace(suffix, '').trim();
  }

  return city.name;
}

function buildCountrySections(
  countries: TravelCountrySummary[],
  cities: NormalizedTravelCity[],
): TravelCountrySection[] {
  return countries.map((country) => ({
    ...country,
    cities: cities.filter((city) => city.countryCode === country.code),
  }));
}

function formatTravelCityLabel(city: NormalizedTravelCity): string {
  const subdivisionCode = city.stateCode ?? city.provinceCode;
  const displayName = travelCityDisplayName(city);
  return subdivisionCode ? `${displayName}, ${subdivisionCode}` : displayName;
}

function cityNames(cities: NormalizedTravelCity[]): string {
  return cities.map(travelCityDisplayName).join(', ');
}

function regionForCountry(country: TravelCountrySection): string {
  if (country.region === 'Europe') return 'Europe';
  return (
    SUBREGION_LABELS[country.subregion] ??
    country.subregion ??
    country.region ??
    'Other'
  );
}

function regionSlug(regionName: string): string {
  return slugify(regionName);
}

function countrySubdivisionLabel(countryCode: string): string | undefined {
  if (countryCode === US_COUNTRY_CODE) return 'US state';
  if (countryCode === CHINA_COUNTRY_CODE) return 'China province';
  return undefined;
}

function citySubdivision(
  countryCode: string,
  city: NormalizedTravelCity,
): { code: string; name: string } | null {
  if (countryCode === US_COUNTRY_CODE && city.stateCode) {
    return {
      code: city.stateCode,
      name: city.stateName ?? city.stateCode,
    };
  }

  if (countryCode === CHINA_COUNTRY_CODE && city.provinceCode) {
    return {
      code: city.provinceCode,
      name: city.provinceName ?? city.provinceCode,
    };
  }

  return null;
}

function buildSubdivisionGroups(
  country: TravelCountrySection,
): TravelCityGroup[] {
  const groups = country.cities.reduce((subdivisionGroups, city) => {
    const subdivision = citySubdivision(country.code, city);
    if (!subdivision) return subdivisionGroups;
    const group =
      subdivisionGroups.get(subdivision.code) ??
      ({
        id: `${country.code.toLowerCase()}-${subdivision.code.toLowerCase()}`,
        label: subdivision.name,
        meta: subdivision.code,
        cities: [],
        cityNames: '',
      } satisfies TravelCityGroup);

    group.cities.push(city);
    group.cityNames = cityNames(group.cities);
    subdivisionGroups.set(subdivision.code, group);
    return subdivisionGroups;
  }, new Map<string, TravelCityGroup>());

  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function buildTravelRegionGroups(
  countrySections: TravelCountrySection[],
): TravelRegionGroup[] {
  const regionGroups = countrySections
    .filter((country) => country.cityCount > 0)
    .reduce((groups, country) => {
      const regionName = regionForCountry(country);
      const group =
        groups.get(regionName) ??
        ({
          name: regionName,
          slug: regionSlug(regionName),
          countries: [],
          cityCount: 0,
        } satisfies TravelRegionGroup);

      group.countries.push({
        ...country,
        cityList: country.cities.map(formatTravelCityLabel).join(', '),
        subdivisionGroups: buildSubdivisionGroups(country),
        subdivisionLabel: countrySubdivisionLabel(country.code),
      });
      group.cityCount += country.cityCount;
      groups.set(regionName, group);
      return groups;
    }, new Map<string, TravelRegionGroup>());

  return [...regionGroups.values()]
    .map((group) => ({
      ...group,
      countries: group.countries.sort((a, b) => {
        const count = b.cityCount - a.cityCount;
        if (count !== 0) return count;
        return a.name.localeCompare(b.name);
      }),
    }))
    .sort((a, b) => {
      const aIndex = REGION_ORDER.indexOf(a.name);
      const bIndex = REGION_ORDER.indexOf(b.name);
      return (
        (aIndex === -1 ? Number.POSITIVE_INFINITY : aIndex) -
        (bIndex === -1 ? Number.POSITIVE_INFINITY : bIndex)
      );
    });
}

export function getTravelPageData(
  collectionData: TravelCollectionData | undefined,
): TravelPageData {
  const cities = normalizeTravelCities(collectionData?.cities);
  const countries = buildTravelCountries(
    cities,
    collectionData?.visitedCountries,
  );
  const usStates = buildTravelUsStates(cities, collectionData?.visitedUsStates);
  const chinaProvinces = buildTravelChinaProvinces(
    cities,
    collectionData?.visitedChinaProvinces,
  );
  const countrySections = buildCountrySections(countries, cities);

  return {
    collectionName: collectionData?.name ?? 'Travel Map',
    collectionDescription:
      collectionData?.description ??
      'Cities and places from a personal travel log.',
    cities,
    countries,
    countrySections,
    cityRegionGroups: buildTravelRegionGroups(countrySections),
    usStates,
    chinaProvinces,
    map: buildTravelMapPayload(cities, countries, usStates, chinaProvinces),
    stats: {
      cityCount: cities.length,
      countryCount: countries.length,
      usStateCount: usStates.length,
      chinaProvinceCount: chinaProvinces.length,
    },
  };
}

const COUNTRY_GEOJSON_URL = '/assets/geo/countries-110m.geojson';
const COUNTRY_DISPLAY_OVERRIDES = new Map([
  ['CHN', '中国'],
  ['TWN', '台湾'],
]);
const COUNTRY_ALIAS_OVERRIDES = new Map([
  ['CHN', ['台湾', '台灣', '中华民国', '中華民國', 'Republic of China', 'ROC']],
]);
const COUNTRY_FEATURE_INCLUDES = new Map([
  ['CHN', ['TWN']],
]);
const SYNTHETIC_COUNTRIES = [
  {
    id: 'bahrain',
    feature: null,
    features: [],
    center: { lat: 26.0667, lon: 50.5577 },
    displayName: '巴林',
    englishName: 'Bahrain',
    isoA2: 'BH',
    isoA3: 'BHR',
    aliases: ['巴林', 'Bahrain', 'BH', 'BHR'],
  },
];

function getCountryCode(properties) {
  return properties.ISO_A3 || properties.ADM0_A3 || '';
}

function isCountryCode(properties, code) {
  return properties.ISO_A3 === code || properties.ADM0_A3 === code;
}

function normalizeLookupValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_.-]+/g, '');
}

function getFeatureNames(feature) {
  const properties = feature?.properties || {};
  return [
    properties.ADMIN,
    properties.NAME,
    properties.NAME_LONG,
    properties.NAME_EN,
    properties.NAME_ZH,
    properties.NAME_ZHT,
    properties.FORMAL_EN,
    properties.BRK_NAME,
  ].filter(Boolean);
}

function getFeatureCodes(feature) {
  const properties = feature?.properties || {};
  return [
    properties.ISO_A2,
    properties.ISO_A3,
    properties.ADM0_A3,
    properties.ADM0_A3_US,
    properties.ADM0_ISO,
    properties.GU_A3,
    properties.SU_A3,
    properties.WB_A2,
    properties.WB_A3,
  ]
    .filter(Boolean)
    .filter((value) => String(value) !== '-99');
}

function getPolygonGroups(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function normalizeLongitude(lon) {
  if (lon > 180) return lon - 360;
  if (lon < -180) return lon + 360;
  return lon;
}

function calculateFeatureCenter(feature) {
  const properties = feature?.properties || {};
  const labelLat = Number(properties.LABEL_Y);
  const labelLon = Number(properties.LABEL_X);

  if (Number.isFinite(labelLat) && Number.isFinite(labelLon)) {
    return { lat: labelLat, lon: normalizeLongitude(labelLon) };
  }

  let latTotal = 0;
  let lonTotal = 0;
  let count = 0;

  getPolygonGroups(feature?.geometry).forEach((polygon) => {
    const exterior = polygon[0] || [];
    exterior.forEach(([lon, lat]) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      latTotal += lat;
      lonTotal += normalizeLongitude(lon);
      count += 1;
    });
  });

  return count ? { lat: latTotal / count, lon: lonTotal / count } : null;
}

function toNodeId(feature) {
  const properties = feature?.properties || {};
  const code = [properties.ISO_A3, properties.ADM0_A3, properties.ISO_A2]
    .find((value) => value && String(value) !== '-99');
  return String(code || properties.NAME || 'country')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function getCountryDisplayName(feature) {
  const properties = feature?.properties || {};
  const override = COUNTRY_DISPLAY_OVERRIDES.get(properties.ISO_A3) || COUNTRY_DISPLAY_OVERRIDES.get(properties.ADM0_A3);
  if (override) return override;
  return properties.NAME_ZH || properties.NAME_EN || properties.ADMIN || properties.NAME || '';
}

export function createCountryCatalog(features = []) {
  const featureByCode = new Map();

  features.forEach((feature) => {
    const properties = feature?.properties || {};
    [properties.ISO_A3, properties.ADM0_A3]
      .filter(Boolean)
      .filter((value) => String(value) !== '-99')
      .forEach((code) => {
        if (!featureByCode.has(code)) featureByCode.set(code, feature);
      });
  });

  return features
    .map((feature) => {
      const properties = feature?.properties || {};
      if (isCountryCode(properties, 'TWN')) return null;

      const countryCode = getCountryCode(properties);
      const includedFeatures = (COUNTRY_FEATURE_INCLUDES.get(countryCode) || [])
        .map((code) => featureByCode.get(code))
        .filter(Boolean);
      const countryFeatures = [feature, ...includedFeatures];
      const names = countryFeatures.flatMap(getFeatureNames);
      const codes = countryFeatures.flatMap(getFeatureCodes);
      const center = calculateFeatureCenter(feature);

      if (!names.length || !center) return null;

      return {
        id: toNodeId(feature),
        feature,
        features: countryFeatures,
        center,
        displayName: getCountryDisplayName(feature),
        englishName: properties.NAME_EN || properties.ADMIN || properties.NAME || '',
        isoA2: properties.ISO_A2 && properties.ISO_A2 !== '-99' ? properties.ISO_A2 : '',
        isoA3: properties.ISO_A3 && properties.ISO_A3 !== '-99' ? properties.ISO_A3 : properties.ADM0_A3 || '',
        aliases: [
          ...new Set([
            ...names,
            ...codes,
            ...(COUNTRY_ALIAS_OVERRIDES.get(getCountryCode(properties)) || []),
          ]),
        ],
      };
    })
    .filter(Boolean)
    .concat(SYNTHETIC_COUNTRIES)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-Hans'));
}

export function createCountryLookup(catalog = []) {
  const lookup = new Map();

  catalog.forEach((country) => {
    [country.id, country.displayName, country.englishName, country.isoA2, country.isoA3, ...country.aliases]
      .map(normalizeLookupValue)
      .filter(Boolean)
      .forEach((key) => {
        if (!lookup.has(key)) lookup.set(key, country);
      });
  });

  return lookup;
}

export function findCountryForNode(nodeOrId, countryLookup) {
  if (!countryLookup) return null;

  const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId?.id;
  const name = typeof nodeOrId === 'string' ? '' : nodeOrId?.name;
  const candidates = [id, name].map(normalizeLookupValue).filter(Boolean);

  return candidates.map((candidate) => countryLookup.get(candidate)).find(Boolean) || null;
}

export async function loadCountryCatalog() {
  const response = await fetch(COUNTRY_GEOJSON_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Country GeoJSON ${response.status}`);
  const geojson = await response.json();
  return createCountryCatalog(geojson.features || []);
}

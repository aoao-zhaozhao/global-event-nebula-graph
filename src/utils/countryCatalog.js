const COUNTRY_GEOJSON_URL = '/assets/geo/countries-110m.geojson';

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
  return properties.NAME_ZH || properties.NAME_EN || properties.ADMIN || properties.NAME || '';
}

export function createCountryCatalog(features = []) {
  return features
    .map((feature) => {
      const properties = feature?.properties || {};
      const names = getFeatureNames(feature);
      const codes = getFeatureCodes(feature);
      const center = calculateFeatureCenter(feature);

      if (!names.length || !center) return null;

      return {
        id: toNodeId(feature),
        feature,
        center,
        displayName: getCountryDisplayName(feature),
        englishName: properties.NAME_EN || properties.ADMIN || properties.NAME || '',
        isoA2: properties.ISO_A2 && properties.ISO_A2 !== '-99' ? properties.ISO_A2 : '',
        isoA3: properties.ISO_A3 && properties.ISO_A3 !== '-99' ? properties.ISO_A3 : properties.ADM0_A3 || '',
        aliases: [...new Set([...names, ...codes])],
      };
    })
    .filter(Boolean)
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
  const response = await fetch(COUNTRY_GEOJSON_URL, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Country GeoJSON ${response.status}`);
  const geojson = await response.json();
  return createCountryCatalog(geojson.features || []);
}

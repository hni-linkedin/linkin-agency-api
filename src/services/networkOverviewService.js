const Capture = require('../models/Capture');
const { parseHeadline } = require('../utils/parseHeadline');
const {
  mergeCompanyCountsByPrefix,
  topCompaniesFromMerged,
} = require('../utils/companyCluster');

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function getCache(clientId) {
  const e = cache.get(clientId);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(clientId);
    return null;
  }
  return e.payload;
}

function setCache(clientId, payload) {
  cache.set(clientId, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateNetworkOverviewCache(clientId) {
  if (clientId) {
    cache.delete(String(clientId));
  }
}

/**
 * Normalize to the four canonical fields (followers/following use `heading`).
 * @param {object} raw
 * @returns {{ name: string, headline: string, profileUrl: string | null, image: string | null }}
 */
function normalizePerson(raw) {
  if (!raw || typeof raw !== 'object') {
    return { name: '', headline: '', profileUrl: null, image: null };
  }
  return {
    name: raw.name != null ? String(raw.name) : '',
    headline: raw.headline != null ? String(raw.headline) : raw.heading != null ? String(raw.heading) : '',
    profileUrl: raw.profileUrl != null && raw.profileUrl !== '' ? String(raw.profileUrl) : null,
    image: raw.image != null ? String(raw.image) : null,
  };
}

function normalizeList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizePerson);
}

function personKey(p) {
  if (p.profileUrl && String(p.profileUrl).trim()) {
    return String(p.profileUrl).trim();
  }
  return `__anon:${p.name}::${p.headline}`;
}

/**
 * Use LinkedIn page total from parsed capture when present; otherwise snapshot list length.
 * @param {object | null | undefined} data — parsedData.data
 * @param {number} listLength
 */
function totalCountFromCapture(data, listLength) {
  if (data && data.totalCount != null) {
    const n = Number(data.totalCount);
    if (Number.isFinite(n) && n >= 0) {
      return n;
    }
  }
  return listLength;
}

/** @param {Map<string, number>} map */
function increment(map, key) {
  if (!key || !String(key).trim()) return;
  const k = String(key).trim();
  map.set(k, (map.get(k) || 0) + 1);
}

/**
 * @param {string} clientId
 * @returns {Promise<object>}
 */
async function buildNetworkOverview(clientId) {
  const [connDoc, folDoc, ingDoc] = await Promise.all([
    Capture.findOne({
      clientId,
      pageType: 'network_connections',
      deleted: false,
    })
      .sort({ capturedAt: -1 })
      .select('parsedData.data capturedAt _id')
      .lean(),
    Capture.findOne({
      clientId,
      pageType: 'network_followers',
      deleted: false,
    })
      .sort({ capturedAt: -1 })
      .select('parsedData.data capturedAt _id')
      .lean(),
    Capture.findOne({
      clientId,
      pageType: 'network_following',
      deleted: false,
    })
      .sort({ capturedAt: -1 })
      .select('parsedData.data capturedAt _id')
      .lean(),
  ]);

  const warnings = [];
  if (!connDoc) warnings.push('Missing capture for pageType network_connections');
  if (!folDoc) warnings.push('Missing capture for pageType network_followers');
  if (!ingDoc) warnings.push('Missing capture for pageType network_following');

  const connData = connDoc?.parsedData?.data;
  const folData = folDoc?.parsedData?.data;
  const ingData = ingDoc?.parsedData?.data;

  const connections = normalizeList(connData?.connections);
  const followers = normalizeList(folData?.followers);
  const following = normalizeList(ingData?.following);

  const connectionsCount = totalCountFromCapture(connData, connections.length);
  const followersCount = totalCountFromCapture(folData, followers.length);
  const followingCount = totalCountFromCapture(ingData, following.length);

  const connectionUrls = new Set(
    connections.map((p) => p.profileUrl).filter(Boolean).map((u) => String(u).trim())
  );

  const followerUrls = new Set(
    followers.map((p) => p.profileUrl).filter(Boolean).map((u) => String(u).trim())
  );

  const followingUrls = new Set(
    following.map((p) => p.profileUrl).filter(Boolean).map((u) => String(u).trim())
  );

  const overlapSignals = followers.filter((p) => {
    const u = p.profileUrl && String(p.profileUrl).trim();
    return u && !connectionUrls.has(u);
  });

  const oneSidedFollows = following.filter((p) => {
    const u = p.profileUrl && String(p.profileUrl).trim();
    return u && !followerUrls.has(u);
  });

  let mutualCount = 0;
  for (const u of followerUrls) {
    if (followingUrls.has(u)) mutualCount += 1;
  }

  const overlapCount = overlapSignals.length;
  const oneSidedCount = oneSidedFollows.length;

  const overlapSample = overlapSignals.slice(0, 10);
  const oneSidedSample = oneSidedFollows.slice(0, 10);

  const followerToConnection =
    connectionsCount === 0 ? null : (followersCount / connectionsCount).toFixed(2);

  // Unique people (connections first, then followers, then following)
  const uniqueByKey = new Map();
  const mergeOrder = [...connections, ...followers, ...following];
  for (const p of mergeOrder) {
    const k = personKey(p);
    if (!uniqueByKey.has(k)) uniqueByKey.set(k, p);
  }
  const uniquePeople = [...uniqueByKey.values()];

  const parsedByPerson = new Map();
  for (const p of uniquePeople) {
    parsedByPerson.set(personKey(p), parseHeadline(p.headline));
  }

  const companyCounts = new Map();
  for (const p of uniquePeople) {
    const parsed = parsedByPerson.get(personKey(p));
    const cc = parsed?.currentCompany;
    if (cc) {
      increment(companyCounts, `company:${cc}`);
    }
  }
  const rawCurrent = new Map();
  for (const [k, count] of companyCounts.entries()) {
    rawCurrent.set(k.replace(/^company:/, ''), count);
  }
  const topCurrentCompanies = topCompaniesFromMerged(
    mergeCompanyCountsByPrefix(rawCurrent),
    10
  );

  const exMap = new Map();
  for (const p of uniquePeople) {
    const parsed = parsedByPerson.get(personKey(p));
    for (const ex of parsed?.exCompanies || []) {
      increment(exMap, ex);
    }
  }
  const topExCompanies = topCompaniesFromMerged(mergeCompanyCountsByPrefix(exMap), 10);

  const meta = {
    connections: connDoc
      ? { captureId: connDoc._id, capturedAt: connDoc.capturedAt }
      : null,
    followers: folDoc ? { captureId: folDoc._id, capturedAt: folDoc.capturedAt } : null,
    following: ingDoc ? { captureId: ingDoc._id, capturedAt: ingDoc.capturedAt } : null,
  };

  return {
    success: true,
    clientId,
    generatedAt: new Date().toISOString(),
    warnings,
    counts: {
      connections: connectionsCount,
      followers: followersCount,
      following: followingCount,
      overlapSignals: overlapCount,
      oneSidedFollows: oneSidedCount,
      mutualFollows: mutualCount,
    },
    ratios: {
      followerToConnection: followerToConnection,
    },
    overlapSample,
    oneSidedSample,
    topCurrentCompanies,
    topExCompanies,
    meta,
  };
}

/**
 * @param {string} clientId
 */
async function getNetworkOverview(clientId) {
  const cached = getCache(clientId);
  if (cached) {
    return cached;
  }
  const payload = await buildNetworkOverview(clientId);
  setCache(clientId, payload);
  return payload;
}

module.exports = {
  buildNetworkOverview,
  getNetworkOverview,
  invalidateNetworkOverviewCache,
};

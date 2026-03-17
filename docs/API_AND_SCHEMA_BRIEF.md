# Backend: Endpoints, Parsed Data Schema & DB Storage (Brief)

---

## 1. Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/health` | No | Health check `{ status, uptime }` |
| POST | `/api/capture` | API key | Create capture: upload HTML + metadata → parse → store in DB + Cloudinary |
| GET | `/api/capture` | API key | List captures. Query: `clientId`, `pageType`, `page`, `limit` |
| GET | `/api/capture/:id` | API key | One capture by ID |
| GET | `/api/capture/client/:clientId` | API key | Captures for client. Query: `pageType`, `groupBy=pageType`, `latestOnly` |
| GET | `/api/capture/impressions/:clientId` | API key | Impressions captures (7d/28d/90d) for client |
| GET | `/api/capture/engagements/:clientId` | API key | Engagements captures for client |
| GET | `/api/capture/audience/:clientId` | API key | Audience (followers) captures |
| GET | `/api/capture/demographics/:clientId` | API key | Search-appearances (demographics) captures |
| GET | `/api/capture/summary/:clientId` | API key | Dashboard summary: latest profile, impressions 7d/28d, engagements 28d, audience, search, profile views |
| GET | `/api/capture/home/:clientId` | API key | Home: summary (full parsedData.data per type) + freshness — **exact shape in §5** |
| DELETE | `/api/capture/:id` | API key | Soft-delete capture |

All `/api/capture` routes require API key (e.g. `x-api-key` header).

---

## 2. How Data Is Stored in DB

**Collection:** `captures` (MongoDB, db from `MONGO_DB`).

**One document per capture** (created by POST `/api/capture`):

| Field | Type | Description |
|-------|------|-------------|
| `clientId` | String | Required, indexed |
| `clientName` | String | Optional |
| `pageType` | String | Required, indexed. Which LinkedIn page (e.g. `analytics_posts_impressions_7d`) |
| `capturedAt` | Date | When the page was captured |
| `tabUrl` | String | LinkedIn URL of the page |
| `cloudinaryUrl` | String | URL of uploaded HTML on Cloudinary |
| `cloudinaryId` | String | Cloudinary public_id |
| **`parsedData`** | **Mixed** | **Full parser result** (see §3). `{ pageType, parsedAt, parse_error, data }` |
| `parseSuccess` | Boolean | True if `parsedData.parse_error === null` |
| `agentVersion` | String | Optional |
| `notes` | String | Optional |
| `deleted` | Boolean | Default false; soft-delete flag |
| `createdAt` | Date | Auto |
| `updatedAt` | Date | Auto |

**Parsed content lives inside `parsedData.data`**; shape depends on `pageType` (below).

---

## 3. Parsed Data Schema by Page Type

**Top-level** (same for all): `parsedData = { pageType, parsedAt, parse_error, data }`.  
`parse_error` is `null` on success; `data` is the object below per type.

| pageType | `parsedData.data` shape (brief) |
|----------|----------------------------------|
| **profile_main** | `profileName`, `headline`, `location`, `about`, `topSkills`, `experience[]` |
| **analytics_posts_impressions_7d / 28d / 90d** | `impressions: { totalImpression, deltaChange, deltaColor }`, `members: { totalMembersReached?, deltaChange?, deltaColor? }`, `top_posts[]` (postDescription, engagementsCount, commentsCount, impressionsStat, impressionDeltaLabel, impressionDeltaColor) |
| **analytics_posts_engagements_7d / 28d / 90d** | `engagements: { totalEngagements, deltaChange, deltaColor }`, `engagements_split: { reactions?, comments?, reposts?, saves?, sendsOnLinkedIn? }`, `visitsToLinks`, `top_posts[]` (same shape as impressions) |
| **analytics_audience** (+ _7d/_28d/_90d) | `followers: { totalFollowers, deltaChange, deltaColor }`, `insights: { experience, location, industry }` each `{ name, percentage }` |
| **analytics_audience_demographics** | `job_title[]`, `location[]`, `industry[]`, `seniority[]`, `company_size[]`, `company[]` — each item `{ title, percentage }` (top 5; company = all) |
| **analytics_search_appearances** | `totalAppearances`, `delta`, `whereYouAppeared: { posts, networkRecommendations, comments, search }`, `topSearcherCompanies[]`, `topSearcherTitles[]`, `titlesFoundFor[]` — companies items `{ label, image }`, titles `{ label }` |
| **analytics_profile_views** | `totalViews`, `delta`, `viewers[]: { name, headline, avatar }` |
| **network_connections** | `connections[]` (name, headline, profileUrl, image), `totalCount` |
| **network_followers** | Same as network_connections (people who follow you) |
| **network_following** | Same as network_connections (accounts you follow) |
| **feed** | `data: {}` (no parsing) |

---

## 4. Flow Summary

1. **POST /api/capture**: Body + `htmlFile` → validate → upload HTML to Cloudinary → parse HTML by `pageType` → build `parsedData` → save one **Capture** doc with `parsedData` (and metadata) → return `captureId` + summary.
2. **GET** endpoints read from **Capture**; list/filter by `clientId`, `pageType`, `deleted: false`; summary/home endpoints take **latest** capture per relevant `pageType` and expose `capture.parsedData.data` in the response shape they need.
3. **DELETE /api/capture/:id**: Sets `deleted: true` on that document; no removal of `parsedData`.

So: **one endpoint writes** (POST); **all others read** the same `captures` collection; **parsed content is always in `parsedData.data`** with the schema above per `pageType`.

---

## 5. GET /api/capture/home/:clientId — Real implementation & response shape

**Route:** `GET /api/capture/home/:clientId` (see `src/controllers/captureController.js` → `getHomeDataByClient`).

**Actual route handler (Express/Node):**

```js
// GET /api/capture/home/:clientId
const getHomeDataByClient = async (req, res, next) => {
    try {
        const { clientId } = req.params;

        const freshnessPipeline = [
            { $match: { clientId, deleted: false } },
            { $sort: { capturedAt: -1 } },
            { $group: { _id: '$pageType', latestCapture: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$latestCapture' } }
        ];

        const [
            freshnessData,
            profile,
            impressions7d,
            impressions28d,
            impressions90d,
            engagements7d,
            engagements28d,
            engagements90d,
            audience,
            audience7d,
            audience28d,
            audience90d,
            search,
            views
        ] = await Promise.all([
            Capture.aggregate(freshnessPipeline),
            Capture.findOne({ clientId, pageType: 'profile_main', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_impressions_7d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_impressions_28d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_impressions_90d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_engagements_7d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_engagements_28d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_engagements_90d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_audience', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_audience_7d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_audience_28d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_audience_90d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_search_appearances', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_profile_views', deleted: false }).sort({ capturedAt: -1 })
        ]);

        const summary = {
            profile: profile?.parsedData?.data || null,
            impressions7d: impressions7d?.parsedData?.data || null,
            impressions28d: impressions28d?.parsedData?.data || null,
            impressions90d: impressions90d?.parsedData?.data || null,
            engagements7d: engagements7d?.parsedData?.data || null,
            engagements28d: engagements28d?.parsedData?.data || null,
            engagements90d: engagements90d?.parsedData?.data || null,
            audience: audience?.parsedData?.data || null,
            audience7d: audience7d?.parsedData?.data || null,
            audience28d: audience28d?.parsedData?.data || null,
            audience90d: audience90d?.parsedData?.data || null,
            search: search?.parsedData?.data || null,
            profileViews: views?.parsedData?.data || null,
            lastCapturedAt: profile?.capturedAt || impressions28d?.capturedAt || impressions7d?.capturedAt || new Date()
        };

        const homeData = { summary, freshnessData };

        res.json({ success: true, data: homeData });
    } catch (error) {
        next(error);
    }
};
```

**Handler logic (what the backend does):**

1. Runs an aggregation: for the given `clientId` and `deleted: false`, groups by `pageType`, keeps the **latest** capture per type (`$sort` by `capturedAt: -1`, then `$first: '$$ROOT'`). Result is an array of **full Capture documents** → this is `freshnessData`.
2. In parallel, fetches the **single latest** Capture for each of: `profile_main`; impressions 7d/28d/90d; engagements 7d/28d/90d; `analytics_audience`, `analytics_audience_7d`, `analytics_audience_28d`, `analytics_audience_90d`; `analytics_search_appearances`; `analytics_profile_views`.
3. Builds **summary**: each key is the **full** `parsedData.data` for that capture (or null). No separate historicalImpressions — impressions7d/28d/90d are the full objects (impressions, members, top_posts).
4. Sends `res.json({ success: true, data: homeData })` where `homeData = { summary, freshnessData }`.

**Exact response structure (use this for the frontend):**

```ts
// Response
{
  success: true;
  data: {
    summary: {
      profile: ProfileParsedData | null;
      impressions7d: ImpressionsParsedData | null;   // full { impressions, members, top_posts }
      impressions28d: ImpressionsParsedData | null;
      impressions90d: ImpressionsParsedData | null;
      engagements7d: EngagementsParsedData | null;   // full { engagements, engagements_split, visitsToLinks, top_posts }
      engagements28d: EngagementsParsedData | null;
      engagements90d: EngagementsParsedData | null;
      audience: AudienceParsedData | null;           // analytics_audience (no cadence)
      audience7d: AudienceParsedData | null;
      audience28d: AudienceParsedData | null;
      audience90d: AudienceParsedData | null;
      search: SearchParsedData | null;
      profileViews: ProfileViewsParsedData | null;
      lastCapturedAt: string;  // ISO Date
    };
    freshnessData: Capture[];  // full Capture docs — one per pageType (latest only)
  };
}
```

**Important:** Every `summary.*` value (except `lastCapturedAt`) is the **full** `parsedData.data` for that page type (see §3). No separate `historicalImpressions`; use `summary.impressions7d` / `impressions90d` for full impressions data including `members` and `top_posts`.

---

#### Summary fields that are often `null` — exact shape when present

When a capture doesn’t exist for that type, the key is `null`. When it exists, the value has one of these shapes (same as in §3).

**`summary.profile`** (pageType: `profile_main`):

```json
{
  "profileName": "string",
  "headline": "",
  "location": "",
  "about": "",
  "topSkills": "",
  "experience": []
}
```

**`summary.audience28d`** / **`summary.audience90d`** (same shape as `audience` / `audience7d`):

```json
{
  "followers": {
    "totalFollowers": "1,016",
    "deltaChange": "5.4%",
    "deltaColor": "red"
  },
  "insights": {
    "experience": { "name": "Entry", "percentage": "27%" },
    "location": { "name": "Greater Bengaluru Area", "percentage": "25%" },
    "industry": { "name": "Software Development", "percentage": "20%" }
  }
}
```

**`summary.profileViews`** (pageType: `analytics_profile_views`):

```json
{
  "totalViews": 42,
  "delta": 5,
  "viewers": [
    { "name": "Jane Doe", "headline": "Engineer at X", "avatar": "https://..." }
  ]
}
```

- `totalViews`: number.  
- `delta`: number (positive = increase, negative = decrease).  
- `viewers`: array of `{ name, headline, avatar }`; `avatar` can be `null`.

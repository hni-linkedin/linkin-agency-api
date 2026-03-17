# Parsed Data Structure by Page Type

Every capture stores `parsedData` in the DB with this top-level shape:

```ts
{
  pageType: string;
  parsedAt: string;      // ISO 8601
  parse_error: string | null;
  data: { ... };         // shape below per pageType
}
```

`parse_error` is `null` on success; otherwise it contains the error message and `data` may be `{}`.

---

## 1. `profile_main`

**Source:** `parserService.parseProfileMain($)`

```ts
data: {
  profileName: string | null;
  headline: string | null;
  location: string | null;
  about: string | null;
  topSkills: string | null;
  experience: Array<{ heading: string; subheading: string; date: string }>;
}
```

---

## 2. `analytics_posts_impressions_7d` | `analytics_posts_impressions_28d` | `analytics_posts_impressions_90d`

**Source:** `extractImpressions($)` (same for all three)

```ts
data: {
  impressions: {
    totalImpression: string;   // e.g. "1,234"
    deltaChange: string | null;
    deltaColor: "green" | "red" | null;
  };
  members: {
    totalMembersReached?: string;
    deltaChange?: string;
    deltaColor?: "green" | "red";
  };
  top_posts: Array<{
    postDescription: string;
    engagementsCount: string;
    commentsCount: string;
    impressionsStat: string;
    impressionDeltaLabel: "increased" | "decreased" | "no-change";
    impressionDeltaColor: "green" | "red" | "gray";
  }>;   // up to 3 items
}
```

---

## 3. `analytics_posts_engagements_7d` | `analytics_posts_engagements_28d` | `analytics_posts_engagements_90d`

**Source:** `extractEngagements($)` (same for all three)

```ts
data: {
  engagements: {
    totalEngagements: string;
    deltaChange: string | null;
    deltaColor: "green" | "red" | null;
  };
  engagements_split: {
    reactions?: string;
    comments?: string;
    reposts?: string;
    saves?: string;
    sendsOnLinkedIn?: string;
  };
  visitsToLinks: string | null;
  top_posts: Array<{
    postDescription: string;
    engagementsCount: string;
    commentsCount: string;
    impressionsStat: string;           // engagement stat label
    impressionDeltaLabel: "increased" | "decreased" | "no-change";
    impressionDeltaColor: "green" | "red" | "gray";
  }>;   // up to 3 items
}
```

---

## 4. `analytics_audience` | `analytics_audience_7d` | `analytics_audience_28d` | `analytics_audience_90d`

**Source:** `extractAudience($)` (same for all)

```ts
data: {
  followers: {
    totalFollowers: string | null;
    deltaChange: string | null;
    deltaColor: "green" | "red" | null;
  };
  insights: {
    experience: { name: string | null; percentage: string | null };
    location:  { name: string | null; percentage: string | null };
    industry:  { name: string | null; percentage: string | null };
  };
}
```

---

## 5. `analytics_audience_demographics`

**Source:** `extractDemographics($)`

```ts
data: {
  job_title:    Array<{ title: string; percentage: string }>;   // top 5
  location:     Array<{ title: string; percentage: string }>;   // top 5
  industry:     Array<{ title: string; percentage: string }>;   // top 5
  seniority:    Array<{ title: string; percentage: string }>;   // top 5
  company_size: Array<{ title: string; percentage: string }>;   // top 5
  company:      Array<{ title: string; percentage: string }>;   // all
}
```

---

## 6. `analytics_search_appearances`

**Source:** `extractSearchAppearances($)`

```ts
data: {
  totalAppearances: number;
  delta: number | null;   // positive = increase, negative = decrease
  whereYouAppeared: {
    posts: number;
    networkRecommendations: number;
    comments: number;
    search: number;
  };
  topSearcherCompanies: Array<{ label: string; image: string | null }>;
  topSearcherTitles:    Array<{ label: string; value: string }>;
  titlesFoundFor:       Array<{ label: string; value: string }>;   // keywords
}
```

---

## 7. `analytics_profile_views`

**Source:** `extractProfileViews($)`

```ts
data: {
  totalViews: number;
  delta: number | null;   // positive = increase, negative = decrease
  viewers: Array<{
    name: string;
    headline: string;
    avatar: string | null;
  }>;
}
```

---

## 8. Other page types

**`network_connections`**: `extractConnections($)` — `{ connections: Array<{ name, headline, profileUrl, image }>, totalCount }`.  
**`network_followers`**: `extractFollowers($)` — `{ followers: Array<{ image, name, heading, profileUrl }> }`.  
**`network_following`**: `extractFollowing($)` — `{ following: Array<{ image, name, heading, profileUrl }> }`.  
**`feed`** (and any unknown type): parser returns **empty** `data: {}`.

---

## Quick reference table

| pageType | Main data keys |
|----------|-----------------|
| `profile_main` | `profileName`, `headline`, `location`, `about`, `topSkills`, `experience` |
| `analytics_posts_impressions_*` | `impressions`, `members`, `top_posts` |
| `analytics_posts_engagements_*` | `engagements`, `engagements_split`, `visitsToLinks`, `top_posts` |
| `analytics_audience*` | `followers`, `insights` (experience, location, industry) |
| `analytics_audience_demographics` | `job_title`, `location`, `industry`, `seniority`, `company_size`, `company` |
| `analytics_search_appearances_*` (where/companies/titles/found_for) | per-section keys (see above) |
| `analytics_profile_views` | `totalViews`, `delta`, `viewers` |
| `network_connections` | `connections` (name, headline, profileUrl, image), `totalCount` |
| `network_followers` | `followers` (image, name, heading, profileUrl) |
| `network_following` | `following` (image, name, heading, profileUrl) |
| `feed` | (empty) |

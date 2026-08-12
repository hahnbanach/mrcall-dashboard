# Conversation Analytics API Guide

API reference for building the analytics dashboard. All endpoints require Firebase JWT authentication and return JSON.

---

## Authentication

Every request must include the Firebase JWT token in the `auth` header:

```
auth: <firebase_jwt_token>
```

**Role-based scoping:**
- **Admin users** see analytics across all businesses (no owner filter). Admins can optionally pass `ownerId` in the request body to scope results to a specific user.
- **Regular users** see only their own data (scoped by `user_id`). The `ownerId` field is silently ignored for non-admin users.

---

## Base URL

```
POST /mrcall/v1/{realm}/customer/analytics/{endpoint}
```

Replace `{realm}` with the Firebase realm identifier (e.g. `firebase`).

---

## Common Request Body

All endpoints accept the same request body:

```json
{
  "timestampGte": 1706140800000,
  "timestampLte": 1706745600000,
  "businessId": "optional-business-uuid",
  "ownerId": "optional-firebase-uid"
}
```

| Field          | Type              | Required | Description                                                     |
|----------------|-------------------|----------|-----------------------------------------------------------------|
| `timestampGte` | `Long` (epoch ms) | No       | Start of date range (inclusive). Defaults to 7 days ago.        |
| `timestampLte` | `Long` (epoch ms) | No       | End of date range (inclusive). Defaults to now.                 |
| `businessId`   | `String`          | No       | Filter to a specific business. Omit to include all businesses.  |
| `ownerId`      | `String`          | No       | **Admin-only.** Scope results to a specific owner's data. Silently ignored for non-admin users. |

If both timestamps are omitted, the API defaults to the **last 7 days**.

---

## 1. Dashboard KPIs

High-level metrics with period-over-period comparison. This is the primary data source for KPI cards at the top of the dashboard.

```
POST /mrcall/v1/{realm}/customer/analytics/dashboard
```

**Response:**

```json
{
  "totalCalls": 1542,
  "avgCallDurationMs": 47320,
  "totalCallDurationMs": 65301600,
  "uniqueCallers": 873,
  "previousPeriod": {
    "totalCalls": 1398,
    "avgCallDurationMs": 45100,
    "totalCallDurationMs": 63069800,
    "uniqueCallers": 790
  }
}
```

| Field                | Type    | Description                                                  |
|----------------------|---------|--------------------------------------------------------------|
| `totalCalls`         | `Int`   | Total calls in the period                                    |
| `avgCallDurationMs`  | `Long`  | Average call duration in milliseconds                        |
| `totalCallDurationMs`| `Long`  | Sum of all call durations in milliseconds                    |
| `uniqueCallers`      | `Int`   | Distinct phone numbers that called                           |
| `previousPeriod`     | `Object`| Same metrics for the previous equivalent period (nullable)   |

**UI suggestion:** Show each KPI as a card with the current value and a delta percentage vs `previousPeriod`. Green arrow up for improvement, red arrow down for regression. The previous period is auto-calculated by the backend (same duration, immediately preceding).

---

## 2. Time Series

Metrics bucketed over time. Primary data source for line/area charts.

```
POST /mrcall/v1/{realm}/customer/analytics/timeseries?granularity=daily
```

**Query parameters:**

| Param         | Type     | Default   | Values                                    |
|---------------|----------|-----------|-------------------------------------------|
| `granularity` | `String` | `"daily"` | `hourly`, `daily`, `weekly`, `monthly`    |

**Response:**

```json
{
  "granularity": "daily",
  "period": {
    "from": 1706140800000,
    "to": 1706745600000
  },
  "buckets": [
    {
      "timestamp": 1706140800000,
      "totalCalls": 220,
      "avgCallDurationMs": 46500
    }
  ]
}
```

| Bucket Field         | Type   | Description                              |
|----------------------|--------|------------------------------------------|
| `timestamp`          | `Long` | Start of the time bucket (epoch ms)      |
| `totalCalls`         | `Int`  | Calls in this bucket                     |
| `avgCallDurationMs`  | `Long` | Average duration for calls in this bucket|

**UI suggestion:** Line chart with `totalCalls`. Allow toggling granularity via tabs or a dropdown. For short ranges (1-2 days), default to `hourly`. For ranges over 30 days, default to `weekly` or `monthly`.

---

## 3. Duration Distribution

Call duration histogram with percentile statistics. Shows how long calls typically last.

```
POST /mrcall/v1/{realm}/customer/analytics/duration-distribution
```

**Response:**

```json
{
  "period": {
    "from": 1706140800000,
    "to": 1706745600000
  },
  "totalCompleted": 1380,
  "distribution": [
    { "rangeLabel": "0-5s",    "rangeMinMs": 0,      "rangeMaxMs": 5000,    "count": 45,  "percentage": 3.26 },
    { "rangeLabel": "5-30s",   "rangeMinMs": 5000,    "rangeMaxMs": 30000,   "count": 180, "percentage": 13.04 },
    { "rangeLabel": "30s-1m",  "rangeMinMs": 30000,   "rangeMaxMs": 60000,   "count": 310, "percentage": 22.46 },
    { "rangeLabel": "1-3m",    "rangeMinMs": 60000,   "rangeMaxMs": 180000,  "count": 520, "percentage": 37.68 },
    { "rangeLabel": "3-5m",    "rangeMinMs": 180000,  "rangeMaxMs": 300000,  "count": 210, "percentage": 15.22 },
    { "rangeLabel": "5-10m",   "rangeMinMs": 300000,  "rangeMaxMs": 600000,  "count": 85,  "percentage": 6.16 },
    { "rangeLabel": "10m+",    "rangeMinMs": 600000,  "rangeMaxMs": null,    "count": 30,  "percentage": 2.17 }
  ],
  "percentiles": {
    "p50": 72000,
    "p75": 156000,
    "p90": 270000,
    "p95": 345000,
    "p99": 540000
  }
}
```

| Distribution Field | Type     | Description                                          |
|--------------------|----------|------------------------------------------------------|
| `rangeLabel`       | `String` | Human-readable label for the bucket                  |
| `rangeMinMs`       | `Long`   | Lower bound (inclusive) in milliseconds              |
| `rangeMaxMs`       | `Long?`  | Upper bound (exclusive) in milliseconds, null = open |
| `count`            | `Int`    | Number of calls in this bucket                       |
| `percentage`       | `Double` | Percentage of total completed (2 decimal places)     |

| Percentiles Field | Type   | Description                                |
|-------------------|--------|--------------------------------------------|
| `p50`             | `Long` | Median call duration in milliseconds       |
| `p75`             | `Long` | 75th percentile                            |
| `p90`             | `Long` | 90th percentile                            |
| `p95`             | `Long` | 95th percentile                            |
| `p99`             | `Long` | 99th percentile                            |

**UI suggestion:** Horizontal or vertical bar chart for the distribution. Show percentile lines overlaid or as a separate stat row below (e.g. "50% of calls complete within 1m 12s"). The `0-5s` bucket often indicates hang-ups — consider highlighting it differently.

---

## 4. Hourly Heatmap

Call volume by day-of-week and hour-of-day. Reveals traffic patterns.

```
POST /mrcall/v1/{realm}/customer/analytics/hourly-heatmap?timezone=Europe/Rome
```

**Query parameters:**

| Param      | Type     | Default | Description                                  |
|------------|----------|---------|----------------------------------------------|
| `timezone` | `String` | `"UTC"` | IANA timezone (e.g. `Europe/Rome`, `US/Eastern`) |

**Response:**

```json
{
  "period": {
    "from": 1706140800000,
    "to": 1706745600000
  },
  "timezone": "Europe/Rome",
  "heatmap": [
    { "dayOfWeek": 1, "dayName": "Monday",  "hourOfDay": 9,  "callCount": 42 },
    { "dayOfWeek": 1, "dayName": "Monday",  "hourOfDay": 10, "callCount": 58 },
    { "dayOfWeek": 1, "dayName": "Monday",  "hourOfDay": 11, "callCount": 61 },
    { "dayOfWeek": 2, "dayName": "Tuesday", "hourOfDay": 9,  "callCount": 39 }
  ],
  "peakHour": { "dayOfWeek": 3, "dayName": "Wednesday", "hourOfDay": 11, "callCount": 78 },
  "quietHour": { "dayOfWeek": 7, "dayName": "Sunday", "hourOfDay": 4, "callCount": 0 }
}
```

| Heatmap Cell Field | Type     | Description                             |
|--------------------|----------|-----------------------------------------|
| `dayOfWeek`        | `Int`    | ISO day: 1 = Monday, 7 = Sunday        |
| `dayName`          | `String` | English day name                        |
| `hourOfDay`        | `Int`    | Hour 0-23                               |
| `callCount`        | `Int`    | Number of calls in this slot            |

The array contains up to 168 cells (7 days x 24 hours). Cells with zero calls may be omitted.

**UI suggestion:** 7-row x 24-column grid. Rows = days (Mon-Sun), columns = hours (0-23). Color intensity maps to `callCount` — use a sequential palette (e.g. white to deep blue, or light yellow to dark red). Highlight `peakHour` and `quietHour` with badges or tooltips. Always pass the user's local timezone so the heatmap aligns with their business hours.

---

## 5. Caller Analytics

Caller behavior: who calls, how often, repeat patterns.

```
POST /mrcall/v1/{realm}/customer/analytics/callers?limit=20
```

**Query parameters:**

| Param   | Type  | Default | Range  | Description                      |
|---------|-------|---------|--------|----------------------------------|
| `limit` | `Int` | `20`    | 1-100  | Max number of top callers to return |

**Response:**

```json
{
  "period": {
    "from": 1706140800000,
    "to": 1706745600000
  },
  "uniqueCallers": 873,
  "totalCalls": 1542,
  "avgCallsPerCaller": 1.77,
  "repeatCallerCount": 340,
  "repeatCallerRate": 0.389,
  "callerDistribution": [
    { "callCount": 1, "callerCount": 533, "percentage": 61.05 },
    { "callCount": 2, "callerCount": 198, "percentage": 22.68 },
    { "callCount": 3, "callerCount": 87,  "percentage": 9.97 },
    { "callCount": 4, "callerCount": 33,  "percentage": 3.78 },
    { "callCount": 5, "callerCount": 22,  "percentage": 2.52 }
  ],
  "topCallers": [
    {
      "contactNumber": "+3912345678",
      "callCount": 12,
      "totalDurationMs": 568000,
      "lastCallTimestamp": 1706720400000
    }
  ]
}
```

| Field                | Type     | Description                                                   |
|----------------------|----------|---------------------------------------------------------------|
| `uniqueCallers`      | `Int`    | Distinct phone numbers                                        |
| `totalCalls`         | `Int`    | Total calls in period                                         |
| `avgCallsPerCaller`  | `Double` | Average calls per unique number                               |
| `repeatCallerCount`  | `Int`    | Callers with 2+ calls                                         |
| `repeatCallerRate`   | `Double` | Ratio of repeat callers to unique callers (3 decimal places)  |
| `callerDistribution` | `Array`  | Distribution of callers by call frequency                     |
| `topCallers`         | `Array`  | Most frequent callers, ordered by `callCount` desc            |

| Top Caller Field     | Type     | Description                            |
|----------------------|----------|----------------------------------------|
| `contactNumber`      | `String` | Phone number                           |
| `callCount`          | `Int`    | Number of calls from this number       |
| `totalDurationMs`    | `Long`   | Total talk time in milliseconds        |
| `lastCallTimestamp`  | `Long`   | Most recent call (epoch ms)            |

**UI suggestion:** Show summary stats (unique callers, repeat rate) as cards. Render `callerDistribution` as a bar chart ("1 call", "2 calls", etc.). Display `topCallers` as a sortable table with columns for number, call count, total duration (formatted as hh:mm:ss), and last call (relative time like "2 hours ago"). The `repeatCallerRate` is a good loyalty/engagement metric.

---

## 6. Business Breakdown

Per-business KPI comparison. Shows how calls are distributed across businesses within the resolved scope.

```
POST /mrcall/v1/{realm}/customer/analytics/business-breakdown
```

**Behavior by role:**
- **Owner** — sees their own businesses compared.
- **Admin** — sees all businesses across the platform.
- **Admin + `ownerId`** — sees that specific owner's businesses.

**Response:**

```json
{
  "period": {
    "from": 1706140800000,
    "to": 1706745600000
  },
  "totalCalls": 1500,
  "totalBusinesses": 4,
  "businesses": [
    {
      "businessId": "biz-abc",
      "totalCalls": 800,
      "avgCallDurationMs": 45000,
      "totalCallDurationMs": 36000000,
      "uniqueCallers": 120,
      "callPercentage": 53.33
    },
    {
      "businessId": "biz-xyz",
      "totalCalls": 400,
      "avgCallDurationMs": 32000,
      "totalCallDurationMs": 12800000,
      "uniqueCallers": 85,
      "callPercentage": 26.67
    }
  ]
}
```

| Field              | Type     | Description                                              |
|--------------------|----------|----------------------------------------------------------|
| `totalCalls`       | `Long`   | Aggregate calls across all businesses                    |
| `totalBusinesses`  | `Int`    | Number of businesses with data in the period             |
| `businesses`       | `Array`  | Per-business KPIs, ordered by `totalCalls` descending    |

| Business Entry Field   | Type     | Description                                        |
|------------------------|----------|----------------------------------------------------|
| `businessId`           | `String` | The business identifier                            |
| `totalCalls`           | `Long`   | Calls for this business                            |
| `avgCallDurationMs`    | `Long`   | Average call duration in milliseconds              |
| `totalCallDurationMs`  | `Long`   | Sum of all call durations in milliseconds          |
| `uniqueCallers`        | `Long`   | Distinct phone numbers that called this business   |
| `callPercentage`       | `Double` | Percentage of total calls (2 decimal places)       |

**UI suggestion:** Horizontal bar chart or ranked table showing each business's call volume. Use `callPercentage` for a stacked bar or pie chart. Clicking a business can drill down by setting `businessId` on the other 5 endpoints.

---

## Error Handling

All endpoints return the same error format on failure:

```
HTTP 400 Bad Request
```

```json
{
  "message": "Operation failed. Reference: <correlation-id>"
}
```

The `correlation-id` is a UUID that can be provided to backend engineers for debugging. Display it to the user in error states so they can report it.

---

## Timeout

All endpoints have a **60-second server-side timeout** (circuit breaker). For large date ranges, queries may take several seconds. Show a loading spinner and consider:
- Limiting date range pickers to max 90 days for detailed views.
- Using `monthly` granularity for ranges over 90 days.

---

## Recommended Dashboard Layout

```
+-------------------------------------------------------+
|  Date Range Picker    [Last 7d] [30d] [90d] [Custom]  |
|  Business Filter (admin only)    [All] [Dropdown]      |
|  Owner Filter (admin only)       [All] [Dropdown]      |
+-------------------------------------------------------+
|                                                         |
|  [KPI Cards Row]  (Endpoint 1: dashboard)              |
|  Total Calls | Avg Duration |                          |
|  Unique Callers               (with delta badges)      |
|                                                         |
+-------------------------------------------------------+
|                                                         |
|  [Time Series Chart]  (Endpoint 2: timeseries)         |
|  Granularity: [Hourly|Daily|Weekly|Monthly]             |
|  Lines: Total Calls                                    |
|                                                         |
+--------------------------+----------------------------+
|                          |                            |
| [Duration Distribution]  | [Hourly Heatmap]          |
| (Endpoint 3)             | (Endpoint 4)              |
| Bar chart + percentiles  | 7x24 color grid           |
|                          |                            |
+--------------------------+----------------------------+
|                                                         |
| [Caller Analytics]  (Endpoint 5: callers)               |
| Top callers table + distribution chart                  |
|                                                         |
+---------------------------------------------------------+
|                                                         |
| [Business Breakdown]  (Endpoint 6: business-breakdown)  |
| Bar chart / table comparing businesses by call volume   |
|                                                         |
+---------------------------------------------------------+
```

---

## TypeScript Types

For convenience, here are TypeScript interfaces matching the API:

```typescript
// --- Request ---

interface AnalyticsDateRange {
  timestampGte?: number;  // epoch ms
  timestampLte?: number;  // epoch ms
  businessId?: string;
  ownerId?: string;       // admin-only, scope to specific owner
}

// --- Shared ---

interface AnalyticsPeriod {
  from: number;
  to: number;
}

// --- 1. Dashboard KPIs ---

interface DashboardKpiResponse {
  totalCalls: number;
  avgCallDurationMs: number;
  totalCallDurationMs: number;
  uniqueCallers: number;
  previousPeriod: DashboardPreviousPeriod | null;
}

interface DashboardPreviousPeriod {
  totalCalls: number;
  avgCallDurationMs: number;
  totalCallDurationMs: number;
  uniqueCallers: number;
}

// --- 2. Time Series ---

interface TimeSeriesResponse {
  granularity: string;
  period: AnalyticsPeriod;
  buckets: TimeSeriesBucket[];
}

interface TimeSeriesBucket {
  timestamp: number;
  totalCalls: number;
  avgCallDurationMs: number;
}

// --- 3. Duration Distribution ---

interface DurationDistributionResponse {
  period: AnalyticsPeriod;
  totalCompleted: number;
  distribution: DurationBucket[];
  percentiles: DurationPercentiles;
}

interface DurationBucket {
  rangeLabel: string;
  rangeMinMs: number;
  rangeMaxMs: number | null;
  count: number;
  percentage: number;
}

interface DurationPercentiles {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

// --- 4. Hourly Heatmap ---

interface HourlyHeatmapResponse {
  period: AnalyticsPeriod;
  timezone: string;
  heatmap: HeatmapCell[];
  peakHour: HeatmapCell;
  quietHour: HeatmapCell;
}

interface HeatmapCell {
  dayOfWeek: number;   // 1=Monday, 7=Sunday
  dayName: string;
  hourOfDay: number;   // 0-23
  callCount: number;
}

// --- 5. Caller Analytics ---

interface CallerAnalyticsResponse {
  period: AnalyticsPeriod;
  uniqueCallers: number;
  totalCalls: number;
  avgCallsPerCaller: number;
  repeatCallerCount: number;
  repeatCallerRate: number;
  callerDistribution: CallerDistributionBucket[];
  topCallers: TopCaller[];
}

interface CallerDistributionBucket {
  callCount: number;
  callerCount: number;
  percentage: number;
}

interface TopCaller {
  contactNumber: string;
  callCount: number;
  totalDurationMs: number;
  lastCallTimestamp: number;
}

// --- 6. Business Breakdown ---

interface BusinessBreakdownResponse {
  period: AnalyticsPeriod;
  totalCalls: number;
  totalBusinesses: number;
  businesses: BusinessKpiEntry[];
}

interface BusinessKpiEntry {
  businessId: string;
  totalCalls: number;
  avgCallDurationMs: number;
  totalCallDurationMs: number;
  uniqueCallers: number;
  callPercentage: number;
}

```

---

## cURL Examples

### Dashboard KPIs (last 7 days, default)

```bash
curl -X POST \
  'https://api.example.com/mrcall/v1/firebase/customer/analytics/dashboard' \
  -H 'auth: <firebase_token>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### Time Series (hourly, custom range)

```bash
curl -X POST \
  'https://api.example.com/mrcall/v1/firebase/customer/analytics/timeseries?granularity=hourly' \
  -H 'auth: <firebase_token>' \
  -H 'Content-Type: application/json' \
  -d '{"timestampGte": 1706140800000, "timestampLte": 1706227200000}'
```

### Hourly Heatmap (Rome timezone)

```bash
curl -X POST \
  'https://api.example.com/mrcall/v1/firebase/customer/analytics/hourly-heatmap?timezone=Europe/Rome' \
  -H 'auth: <firebase_token>' \
  -H 'Content-Type: application/json' \
  -d '{"timestampGte": 1703980800000, "timestampLte": 1706745600000}'
```

### Caller Analytics (top 50)

```bash
curl -X POST \
  'https://api.example.com/mrcall/v1/firebase/customer/analytics/callers?limit=50' \
  -H 'auth: <firebase_token>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### Business Breakdown

```bash
curl -X POST \
  'https://api.example.com/mrcall/v1/firebase/customer/analytics/business-breakdown' \
  -H 'auth: <firebase_token>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### Dashboard KPIs scoped to specific owner (admin-only)

```bash
curl -X POST \
  'https://api.example.com/mrcall/v1/firebase/customer/analytics/dashboard' \
  -H 'auth: <admin_firebase_token>' \
  -H 'Content-Type: application/json' \
  -d '{"ownerId": "firebase-uid-of-target-user"}'
```

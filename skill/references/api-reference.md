# RevenueCat Charts API V2 Reference

## Authentication
```
Authorization: Bearer sk_...
Content-Type: application/json
```

## Base URL
`https://api.revenuecat.com/v2`

## Rate Limits
- 120 requests/minute per API key
- Returns `429` with `Retry-After` header when exceeded

## Endpoints

### GET /projects
Returns all projects accessible by the API key.
```json
{ "items": [{ "id": "proj_xxx", "name": "My App" }], "next_page": null }
```

### GET /projects/{id}/metrics/overview
Returns key metrics snapshot (MRR, ARR, active subs, etc.).
```json
{
  "metrics": [
    { "id": "mrr", "name": "MRR", "value": 4560, "unit": "USD", "period": "last_28_days" }
  ]
}
```

### GET /projects/{id}/charts/{chart_name}
Returns time-series data for a specific chart.

**Parameters:**
- `resolution`: `day` | `week` | `month`
- `start_date`: `YYYY-MM-DD`
- `end_date`: `YYYY-MM-DD`

**Response:**
```json
{
  "display_name": "Revenue",
  "measures": [
    { "display_name": "Revenue", "unit": "$", "chartable": true }
  ],
  "values": [
    { "cohort": 1709251200, "measure": 0, "value": 4619.32, "incomplete": false }
  ],
  "summary": { "average": { "0": 4200 }, "total": { "0": 50400 } }
}
```

## Available Charts

| Chart Name | Description | Primary Unit |
|-----------|-------------|-------------|
| `revenue` | Total revenue | $ |
| `mrr` | Monthly Recurring Revenue | $ |
| `arr` | Annual Recurring Revenue | $ |
| `churn` | Churn rate (chartable measure) | % |
| `actives` | Active subscriptions | count |
| `actives_movement` | New/churned/reactivated breakdown | count |
| `actives_new` | New active subscriptions | count |
| `trials` | Active trials | count |
| `trials_movement` | Trial starts/conversions/expirations | count |
| `trials_new` | New trial starts | count |
| `trial_conversion_rate` | Trial to paid conversion | % |
| `conversion_to_paying` | Visitor to paying conversion | % |
| `customers_new` | New customers | count |
| `customers_active` | Active customers | count |
| `refund_rate` | Refund rate | % |
| `ltv_per_customer` | Lifetime value per customer | $ |
| `ltv_per_paying_customer` | LTV per paying customer | $ |
| `mrr_movement` | MRR changes breakdown | $ |
| `subscription_retention` | Cohort retention curves | % |
| `subscription_status` | Status breakdown | count |
| `cohort_explorer` | Cohort analysis | varies |

## Notes
- `chartable: true` on a measure indicates the primary metric for that chart
- `incomplete: true` on values indicates the current period is not yet finished (exclude from analysis)
- Cohort timestamps are Unix epoch seconds
- Charts with multiple measures (e.g., churn has Actives + Churn Rate) — always use the `chartable` one

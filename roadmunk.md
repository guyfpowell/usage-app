# Roadmunk Integration — Parked Idea

## Overview

Pull roadmap data from Roadmunk into the Customer Usage app via their GraphQL API.

## What Roadmunk Provides

- **GraphQL API** (not REST)
- Query roadmaps, items, milestones, fields, dates, owners, statuses, etc.
- Authentication via Bearer token in the `Authorization` header

## What's Needed from the Roadmunk Side (Guy's Tasks)

1. **API Token** — must be an Account Admin; generate from Roadmunk account settings
2. **EU GraphQL endpoint** — `eu.roadmunk.com` has its own gateway, separate from the US default. Confirm the exact URL (likely `https://eu.roadmunk.com/api/graphql`) or contact support@roadmunk.com
3. **Roadmap IDs** — identify which roadmap(s) to pull from
4. **Decide which fields** to surface (name, dates, status, owner, milestones, etc.)

## What Would Be Built

- New API route `/api/roadmunk` in the Next.js app
  - Makes authenticated GraphQL queries to the EU endpoint
  - Returns roadmap items in a normalized shape
- Token stored as an environment variable (e.g. `ROADMUNK_API_TOKEN`)
- New page or section in the app to display roadmap data

## References

- [Roadmunk API Overview](https://roadmunk.com/api-integration/)
- [Getting Started with GraphQL API](https://support.roadmunk.com/hc/en-us/articles/360043799113-Getting-Started-with-Roadmunk-s-GraphQL-API)
- [Querying a Single Roadmap](https://support.roadmunk.com/hc/en-us/articles/360044781433-API-Querying-a-Single-Roadmap)
- [API FAQ](https://support.roadmunk.com/hc/en-us/articles/4410008795287-API-FAQ)

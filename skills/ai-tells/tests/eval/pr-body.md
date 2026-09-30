## Summary

This PR introduces a comprehensive refactor of the caching layer, marking a significant step forward in our performance journey. 🚀

## Changes

- **Cache keys:** Cache keys now include the tenant id, ensuring data isolation across tenants.
- **TTL:** The TTL was lowered from 10 minutes to 2 minutes.
- **Tests:** Tests were added for the eviction path.

## Why This Matters

It's not just a performance fix — it's a security fix. Previously, two tenants with the same user id could see each other's cached dashboards. This PR resolves that issue.

Let me know if you have any questions!

# Documentation maintenance

## Open application discrepancies

- OPEN: `src/utils/Zylch.js` uses native `fetch` for authenticated SSE requests;
  this bypasses the configured Axios 401 interceptor required by project rules.
  Application remediation is outside the documentation bootstrap.

## Oversized docs — reviewed

| doc | lines at review | verdict | date |
|---|---|---|---|
| docs/execution-plans/2026-10-23-dashboard-load.md | 456 | keep whole — active workstream plan read by section | 2026-10-27 |

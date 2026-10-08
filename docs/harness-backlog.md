# Documentation maintenance

## Open application discrepancies

- OPEN: `src/utils/Zylch.js` uses native `fetch` for authenticated SSE requests;
  this bypasses the configured Axios 401 interceptor required by project rules.
  Application remediation is outside the documentation bootstrap.

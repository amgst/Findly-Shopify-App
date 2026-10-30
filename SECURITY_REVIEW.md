# Security and bug review — 2026-10-30

Scope: local source review of authentication, location actions, imports, public widget rendering, analytics, and dependency advisories. No live deployment or database was attacked or changed. Regression tests use mocked database and network calls.

## Fixed

| Priority | Finding | Change |
| --- | --- | --- |
| High | Google Sheet sync accepted arbitrary HTTP/S URLs and followed arbitrary redirects, enabling server-side requests to internal services. | Initial URLs must be HTTPS Google Sheets links. Every redirect is checked against Google download hosts. Downloads have a 15 second deadline, 5 MB limit, and redirect limit. Invalid links are rejected before saving. |
| Medium | Public analytics accepted foreign location IDs; report name lookup lacked an account filter. Knowing another location ID could expose its name through a report. | Validate event location ownership and scope report name lookup to the locator. |
| High, configuration-dependent | Production session signing could fall back to a public development secret if neither secret was configured. | Refuse production startup without SESSION_SECRET or SHOPIFY_API_SECRET. Development uses a random fallback. |
| Medium, hosting-dependent | Forwarded host/protocol headers were used in unescaped widget asset attributes. | Use the configured app URL or request URL origin and escape asset URL attributes. Exploitability depended on which headers the host accepted and how it cached responses. |
| Medium | Spreadsheet applications could execute formula-like text from exported CSV fields. | Prefix formula-like string cells with an apostrophe; retain numeric cells. This also affects phone numbers starting with + when opened as raw CSV text. |
| Medium | A successful but invalid/empty sheet response could remove all previously synced rows. | Reject sheets without valid location rows before replacement. Add a 10,000 row sheet limit and 5 MB CSV limit. Intentionally clearing every synced row now requires deleting the locations explicitly. |
| Low | Concurrent first requests could both attempt to create the same locator. | Use an upsert keyed by account ID. |
| Low | Settings containing valid JSON null caused a runtime error. | Treat null, arrays, and non-object JSON as default settings. |
| Low | Unexpected action failures returned raw exception messages to clients. | Keep detailed errors in server logs and return a generic error. Bound signup and login input lengths before password hashing. |

Google Sheets is now the supported remote import source. Arbitrary hosted CSV URLs are rejected. Use CSV upload for those files. Allowlisting and explicit redirect checks follow [OWASP SSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## Remaining findings

1. **Dependency advisories:** npm audit reported 29 affected package entries overall (26 high, 3 moderate), including seven entries with `--omit=dev` (4 high, 3 moderate). These counts include parent packages affected through the same transitive dependency; they are not 29 distinct exploits. See `.security-audit-production.json` for the registry response.
   - Prisma config uses affected `deepmerge-ts`. The [upstream advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) requires recursive object graphs; ordinary JSON alone cannot produce that condition. The local use is Prisma configuration merging. No remotely reachable exploit was established. npm proposes a Prisma 7 upgrade, which needs a separate migration and compatibility validation.
   - Vercel tooling includes affected `ajv`. The [upstream advisory](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) requires the `$data` option. No app route directly uses that option; no remotely reachable exploit was established. npm reports no automatic fix for this chain.
   - Development-tool findings also remain. Dependency versions were not changed in this review.
2. **Rate limiting:** counters are process-local and the IP helper trusts forwarded headers. Limits reset across serverless invocations and can be bypassed if the ingress does not replace untrusted headers. Configure trusted ingress headers and a shared limiter or host-level rules for login, signup, analytics, and geocoding. Public analytics can still be spoofed; they are not an authenticated source of truth.
3. **Request size enforcement:** CSV and sheet content have application limits, but `request.formData()` and the beacon route's `request.text()` read the incoming request before those checks. Confirm hard body-size limits at the deployment ingress. Large authenticated imports and repeated public requests still need operational resource limits.
4. **Reproducible dependency installation:** package-lock.json is ignored and not tracked. Commit a reviewed lockfile and use npm ci to avoid dependency drift.

## Validation

- `node scripts/check-security.mjs` — passed. Tests block private URLs, credential-bearing URLs, misleading Google hostnames, unsafe redirect targets, redirect loops, oversized streamed/declared responses, foreign analytics locations, unescaped widget attributes, and invalid sheet replacement. Also checks CSV formula escaping, settings defaults, and production startup without a secret.
- `npm.cmd run typecheck` — passed.
- ESLint on every changed source file and regression script — passed.
- `npm.cmd run build` — passed.
- `git diff --check` — passed.

Live Google Sheet redirects, deployment proxy behavior, browser flows, and database concurrency were not integration-tested. Verify those in staging before release. Set a strong session secret and a canonical SHOPIFY_APP_URL in deployment configuration. This review reduces identified risks; it does not certify the app free of vulnerabilities.

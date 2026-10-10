# EstateAtlas architecture

## Decisions

TypeScript / pnpm monorepo: Next.js App Router web, Expo React Native for native Android/iOS, Fastify REST API, real PostgreSQL. Shared Zod 4 validation, property models and currency-aware statistics; shared fetch client used in both apps. Native stack + bottom tabs and react-native-maps; Leaflet + marker clustering in web. No service worker, PWA manifest or mobile web substitute.

A single PostgreSQL database holds users, hashed sessions, owner-scoped properties, valuation history, private binary attachments, and future analysis jobs. SQL uses parameters and explicit owner predicates. Property mutation and history writes run transactionally. The development cluster is local to `.local/`, runs as codexdev, binds loopback, and authenticates with SCRAM. Production can supply DATABASE_URL to a managed/self-hosted PostgreSQL without changing the apps.

## Identity and confidentiality

Scrypt password hashes (N=32768, r=8, p=3; [OWASP memory/CPU-balanced configuration](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt)) with random salts and bounded inputs. Random 256-bit session tokens are hashed in the database, expire after seven days, and are revoked on logout. Web uses HttpOnly SameSite=Lax cookies; native uses bearer sessions persisted in Expo SecureStore. Production cookies require HTTPS. Cookie mutations require an exact allowlisted Origin; registration/login require it for the browser too. CORS grants only the configured WEB_ORIGIN. Rate limiting, request limits, security headers and error redaction apply. No public portfolio or attachment URLs. File content is checked (JPEG/PNG/WebP/PDF), limited, stored privately and served with nosniff. Password reset, email verification, MFA, malware scanning and production operations remain future work.

## Property and portfolio rules

GPS comes from an explicitly selected address suggestion, map click/pin adjustment, or manual entry. Editing the address text invalidates old coordinates. Addresses, type, price, currency, area, year, amenities, condition, notes and archival state share one validated model. Prices are user-entered estimates, labeled accordingly. Dashboard totals and changes are grouped by currency, without invented exchange rates. Histories are dated snapshots of user input, never generated past appreciation. Archive preserves data; deletion cascades histories, attachments and jobs. Test fixtures are explicitly labeled and opt-in per authenticated account.

## Address search

Web and native editors debounce typed queries (minimum four characters); existing addresses are never automatically sent. A protected POST `/geocoding/search` sends only the search text through the API to [Photon](https://github.com/komoot/photon), which explicitly supports search-as-you-type with OpenStreetMap data. The UI identifies the service and credits OpenStreetMap. Queries stay out of request URLs/API request logs and the database. Server-side `GEOCODING_URL` selects a fixed trusted endpoint, never a client-supplied URL. This permits switching to a dedicated instance without client updates. The public demo permits moderate use without an availability guarantee; the public Nominatim service is not used for autocomplete.

Requests require the same authentication and browser CSRF checks as other private API operations. A per-route rate limit plus a global one-request-per-second/in-flight guard limits provider use; a bounded 200-entry, ten-minute per-account RAM cache avoids duplicate requests. Provider errors/timeouts produce a localized fallback rather than made-up coordinates. GeoJSON longitude/latitude order, range, ISO country, field lengths and result count are validated. Approximate street/place matches are identified. Selecting a suggestion updates address, country and coordinates together; dragging/tapping the pin updates only coordinates. Web uses Leaflet; native uses react-native-maps. Pin placement remains available when search fails.

## Maps

Web requests public OpenStreetMap raster tiles directly with attribution and standard browser caching, no prefetch/offline downloads, in accordance with [tile policy](https://operations.osmfoundation.org/policies/tiles/). The provider sees IP and viewed map area, not property records. Native Maps uses Apple Maps on iOS and Google Maps on Android. Development in Expo Go does not require creating a paid service. A standalone Android binary needs a reviewed Google Maps key and restrictions before distribution. GPS/filtering data is identical; implementations differ.

## Analysis extension

Analysis jobs will be persisted with owner/property, requested_at, status (blocked/queued/running/succeeded/failed), provider, errors and result JSON. Result validation includes comparable properties, dated real source URLs, evidence, uncertainty and justified ranges. Until approved APIs are configured, requests remain explicitly blocked with no fabricated valuation. Later add a PostgreSQL-backed worker (SKIP LOCKED, retries, idempotency), cancellation and freshness policies; no Redis requirement initially.

## Environment and verification

Dependencies are pinned in pnpm-lock.yaml. Node 22 is installed only within this project and verified against the upstream checksum. Builds and test artifacts stay ignored. API tests use an isolated real PostgreSQL database/cluster; browser tests cover real authentication and persisted property changes. Browser test servers use ports 3001/4001 and a separate `.next-e2e` Webpack build, so the live development apps on 3000/4000 stay independent. Third-party geocoder responses in tests are labeled fixtures; they never send synthetic/private addresses to Photon. The development launcher invokes app CLIs directly to avoid retaining multiple nested package-manager processes on a small VPS. Both native platforms get Metro exports; exports prove JS bundling, not a device install or an App Store/Play build.

Official references consulted: [Next installation](https://nextjs.org/docs/app/getting-started/installation), [Expo SDK compatibility](https://docs.expo.dev/versions/latest/), [Expo monorepos](https://docs.expo.dev/guides/monorepos/), [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/).

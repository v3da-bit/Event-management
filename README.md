# Ever After

A full stack wedding workspace for Team Groom and Team Bride. Next.js App Router + React, NestJS REST API, MongoDB/Mongoose, shared TypeScript contracts, Google Calendar OAuth, and Cloudinary image uploads.

## Start locally

Requires Node.js 24+, npm, and MongoDB 8 (or Docker Desktop).

```sh
npm install
node scripts/setup.mjs
docker compose up -d mongo
npm run dev
```

Open **http://localhost:3000**. API: **http://localhost:4000**. Interactive Swagger/OpenAPI: **http://localhost:4000/docs** (JSON at `/docs-json`). Register an account and choose your permanent team. `setup.mjs` creates ignored local environment files with unique random JWT/encryption secrets; it does not overwrite existing files. Restart the API after changing environment variables.

If Docker Desktop is unavailable, run `npm run db` in a separate terminal. This downloads/runs an actual MongoDB development binary and persists data in `.local/mongo`; it does not simulate the database. Stop it with Ctrl+C. The first run requires internet access.

For an existing MongoDB/Atlas database, change `MONGODB_URI` in `apps/backend/.env` instead of starting the Mongo container. Never expose a database without authentication outside a local development environment.

### Example celebrations

```sh
SEED_PASSWORD='ChooseYourOwnStrongPassword123' npm run seed
```

Seed creates Aarav (`aarav@example.com`, Groom) and Ananya (`ananya@example.com`, Bride), six February 2027 celebrations, wishlists, and participants. Sign in using your chosen `SEED_PASSWORD`. Existing users and events are preserved. Seed photos use external Unsplash URLs; events without photos have built-in decorative covers. No demo credentials or simulated API responses are used by the UI.

## Features

- Landing, registration, login, dashboard, all/own/joined events, detail/create/edit pages, month/week calendar, profile and settings.
- Permanent team membership. Both teams browse and join any future event; only the owning team can modify events and wishlists. Checks run in backend services after JWT authentication.
- HttpOnly cookie sessions, 15-minute access JWTs, hashed single-use 30-day refresh sessions, atomic refresh rotation, bcrypt passwords, auth rate limits, strict DTO validation, explicit trusted-origin checks for mutations, Helmet and restricted CORS.
- Event search, team/date/period filters, pagination, timezone-aware creation and display, participant counts, creator auto-join, idempotent joins with a unique compound index.
- Wishlist CRUD, image uploads/previews, optimistic completion with rollback, completion attribution and timestamps, pending/completed groups, read-only opposite-team tasks.
- Real Google OAuth consent, AES-256-GCM encrypted refresh tokens, persistent calendar job queue, retries/backoff, per-user event mappings, deterministic Google IDs, connect/reconnect/disconnect and pending event synchronization.
- Cloudinary-backed uploads validate file contents, allow JPEG/PNG/WebP only, cap input at 5 MB and transform image dimensions.
- Accessible dialog primitives, labeled forms/checkboxes, responsive sidebar, mobile navigation, loading/error/empty states, notifications and reduced-motion support.

## Google Calendar setup

1. Create a Google Cloud project and enable **Google Calendar API**.
2. Configure the OAuth consent screen, support/contact email, audience and test users. External testing-mode refresh tokens may expire; publish/verify your consent screen as required for deployment.
3. Create an OAuth client of type **Web application**. Add `http://localhost:4000/google-calendar/callback` as an authorized redirect URI. For deployment, add the exact HTTPS backend callback instead.
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `apps/backend/.env`. Keep the generated `GOOGLE_TOKEN_ENCRYPTION_KEY` stable: it is 32 random bytes encoded as 64 hex characters. Changing it without migrating tokens makes existing refresh tokens unreadable.
5. Start the app, sign in, open Settings, and connect Google Calendar. Email/password login is separate from this connection.

Requested scopes are `calendar.events.owned` (app needs to create/update/remove entries in the user's owned primary calendar) and `openid` (bind mappings to a stable Google account). Google’s scope grants broader access than the app uses; the implementation only addresses app-created event IDs. State is signed, expires in 10 minutes and is bound to a one-use HttpOnly browser nonce. Tokens/client secrets never go to the frontend. Reconnect the same Google account to preserve mappings.

Joining always persists participation even if calendar access is absent. Connected participants receive one Google event each. A MongoDB-backed worker runs every three seconds, leases jobs for two minutes, retries failures with exponential backoff up to an hour, and reconciles persisted domain records in bounded pages to recover interrupted enqueues. Deterministic provider IDs prevent duplicate inserts after crashes. Event edits enqueue all participants; leaving/deleting/disconnecting queues removal. Already-absent provider entries count as successful deletion. Revoked authorization marks the account disconnected and failures remain queued. Reconnect to restore access. Disconnection retains encrypted authorization until app entries have been cleaned up, then erases it. If Google has revoked the token, cleanup requires reconnection.

Event deletion uses a tombstone so delayed cleanup can recover the event's participants and calendar mappings. Wishlists are immediately removed and deleted events are excluded from reads. Tombstones and inactive participation records are intentionally retained for reliable cleanup/auditing; add a retention job only after verifying calendar cleanup completion.

## Image upload setup

Create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the backend environment. Upload uses the server SDK with signed server credentials. Without credentials, upload returns a clear configuration error; image-less events still work. Uploaded assets are public Cloudinary URLs. Asset retention/deletion policies should be configured for your deployment.

## Commands

```sh
npm run dev        # API compile/watch + Next development server
npm run typecheck  # both apps
npm test           # API integration and Google provider unit tests
npm run build      # production TypeScript API + Next build
```

Tests use an isolated real MongoDB process via `mongodb-memory-server`; its first run downloads the platform MongoDB binary and requires network and local-port access. Google responses are mocked in tests only. Production code calls the Google API. Coverage includes registration/login, fixed team assignment, refresh replay, request-origin checks, event validation, both teams' creation, forbidden cross-team writes, wishlist completion/reopening, concurrent joins, leaving, filtering, persistent deletion jobs, token encryption, provider insert/update/delete, insertion conflicts, and revoked credentials.

Live Google consent and Cloudinary upload require your credentials and must be verified with your accounts. Automated provider tests do not establish that your OAuth consent/redirect configuration is correct.

### Browser checks

With the app and database running, seed the demo accounts, then run:

```sh
npx playwright install chromium
TEST_PASSWORD='YourSeedPassword' npm run test:e2e
# Or use an existing Chrome installation:
PLAYWRIGHT_CHANNEL=chrome TEST_PASSWORD='YourSeedPassword' npm run test:e2e
```

The authenticated browser check uses the seeded Groom account and creates/deletes events named `Browser celebration ...`. It removes leftover events with that prefix from the same account's team. Run it against a development database. It checks real login, protected routing, event creation, image-content rejection, wishlist completion, join/leave, deletion, cross-team read-only controls, calendar switching and responsive navigation. Screenshots are written to `.local/screenshots/`. Without `TEST_PASSWORD`, only the public/protected-route check runs. `TEST_EMAIL` and `TEST_BASE_URL` can override the defaults; the integration targets the local API at port 4000.

## API contract

Responses are JSON objects, resource documents or arrays. Event collections return `{ items, total, page, limit }`. Errors use Nest's `{ statusCode, message, error }` format; validation messages are arrays. IDs must be 24-character MongoDB ObjectIds. Dates must include a UTC `Z` or explicit offset. Unknown DTO properties are rejected, including attempted team overrides. `PATCH .../toggle` accepts the desired `{ isCompleted: boolean }` rather than a blind toggle, so concurrent/repeated requests have predictable results.

| Resource      | Endpoints                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Auth          | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh`; `GET /auth/me`                                      |
| User          | `GET /users/me`; `PATCH /users/me`, `/users/me/password`                                                                   |
| Events        | `GET/POST /events`; `GET /events/my-team`, `/events/joined`, `/events/summary`; `GET/PATCH/DELETE /events/:id`             |
| Wishlist      | `GET/POST /events/:eventId/wishlist`; `PATCH/DELETE .../:itemId`; `PATCH .../:itemId/toggle`                               |
| Participation | `POST /events/:id/join`; `DELETE /events/:id/leave`; `GET /events/:id/participants`                                        |
| Calendar      | `GET /google-calendar/connect`, `/callback`, `/status`; `POST /google-calendar/sync`; `DELETE /google-calendar/disconnect` |
| Upload        | `POST /uploads/image` with multipart `file`                                                                                |

Event list queries: `team=GROOM|BRIDE`, `search`, `period=upcoming|past`, ISO `from`/`to` filtering event start, `page` (1+), `limit` (1–100). API mutation clients must supply the configured `FRONTEND_URL` as `Origin`. Swagger's Try It UI on the API origin therefore cannot mutate until you use a trusted-origin API client or host the docs on the frontend origin; read requests work normally with authenticated cookies.

## Architecture

```
apps/frontend/src/app        Next.js public and protected route pages
apps/frontend/src/components Feature screens, shell, upload and shadcn-style UI primitives
apps/frontend/src/lib        Typed API client, formatting, refresh deduplication
apps/backend/src/auth       Cookie/JWT authentication, sessions and guards
apps/backend/src/users      Profile and password endpoints
apps/backend/src/events     Event domain authorization, queries and participation
apps/backend/src/wishlist   Wishlist service and endpoints
apps/backend/src/google-calendar  OAuth and persistent synchronization worker
apps/backend/src/uploads    Content-validated Cloudinary upload
apps/backend/src/common     Mongoose schemas/indexes and validated DTOs
packages/shared-types       Frontend/backend API interfaces
```

Team permission and participation are independent concepts. User team is read from the database on every authenticated request, never from request body or JWT role claims. A unique email index and unique participant `(userId, eventId)` index enforce concurrency invariants. Password/token columns are excluded from normal queries. Authentication cookies never enter localStorage.

## Docker and deployment

```sh
node scripts/setup.mjs
docker compose up --build -d
```

Compose starts MongoDB with a persistent volume, the NestJS API and Next.js frontend. It binds the MongoDB port to loopback. Stop with `docker compose down` (data volume remains). For production, use an authenticated private MongoDB or Atlas, HTTPS reverse proxy, and a secrets manager. Set `NODE_ENV=production`, unique strong JWT secrets, `FRONTEND_URL`, `BACKEND_URL`, Google HTTPS redirect and the frontend build-time `NEXT_PUBLIC_API_URL`. Compose intentionally uses the local development cookie settings from the backend env file unless you change them. Production cookies require HTTPS.

Host frontend and backend on the same site (e.g. `app.example.com` and `api.example.com`) to use SameSite=Lax cookies. Unrelated hosting domains require a deliberate cookie/CSRF configuration change. Restrict the API's origin to the exact frontend URL. Keep at least one API instance running for background jobs; worker leases support multiple instances. Persist secrets and database backups. Build-time frontend API origins must point to the browser-accessible API, not an internal Docker hostname. NestJS and MongoDB require a Node/container hosting service; they cannot be published as a static Sites/Worker deployment.

Dashboard counts use server-side aggregation over all visible records. Calendar loads up to 100 event starts per request; larger periods are fetched in pages.

## Requirements audit

See [docs/REQUIREMENTS-AUDIT.md](docs/REQUIREMENTS-AUDIT.md) for the tested requirements, reproduced fixes, and remaining production reliability findings. Access JWTs now reference active database sessions, so logout and password changes revoke access immediately. Google authorization failure is distinguished from explicit disconnection; reconnecting restores pending synchronization.

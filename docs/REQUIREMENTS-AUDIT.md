# Requirements audit — Ever After

**Verdict: core application flows pass local verification after fixes, but full production acceptance is incomplete.** This is a requirements review and regression run, not a guarantee that every failure mode has been tested.

The reference brief is the user's attached “Pasted text.txt” (the second attachment matches the original brief). The frontend talks to the real NestJS API and persists application data in real MongoDB. Google provider responses are mocked in automated tests; no live Google consent or Cloudinary upload was performed.

## Verification results

| Check | Result | Scope |
| --- | --- | --- |
| Backend Jest suite | PASS: 33 tests, 2 suites | Isolated real MongoDB; mocked Google provider |
| Chrome Playwright suite | PASS: 3 tests | Running Next.js + NestJS + local MongoDB; desktop/mobile |
| Production build | PASS | Nest TypeScript build and Next.js Webpack production build |
| TypeScript | PASS | Both applications |
| Production dependency audit | PASS: 0 reported vulnerabilities | `npm audit --omit=dev --json`; excludes development packages |
| Docker Compose configuration | PASS | `docker compose config --quiet`; does not establish container runtime correctness |
| Docker runtime | NOT VERIFIED | Docker daemon is stopped |
| Google OAuth / live calendar | NOT VERIFIED | Google client ID and secret are missing |
| Cloudinary successful upload | NOT VERIFIED | Cloud name, API key and secret are missing |
| Public HTTPS deployment | NOT VERIFIED | No deployment target configured |

Earlier runs experienced large wall-clock stalls and failed on timeouts. They were not counted as passes. The subsequent `caffeinate -i` runs completed: backend 33/33 in about 19 seconds; Chrome 3/3 in about 27 seconds.

## Defects reproduced and fixed

1. **Required fields could be cleared with null in PATCH requests.** Event titles/descriptions/dates, wishlist titles, and profile names could bypass optional validation. Optional update now means “may be omitted”; required values cannot be null. Optional images remain explicitly removable with null. Regression tests exercise the API and check that rejected writes return 400.
2. **Logged-out access JWTs remained usable.** Access tokens now carry a session ID and authenticate only while that database session exists. Logout revokes both access and refresh use, tested with the old cookies.
3. **Changing a password did not invalidate existing access JWTs.** The same session check now rejects all access tokens after password change removes their sessions. The browser can sign in using the new password.
4. **Expired/revoked Google authorization was conflated with explicit disconnection.** A dedicated disconnect-request flag now distinguishes user-requested cleanup from authorization failure. Revoked credentials require reconnecting and do not trigger deletion of existing entries just because authorization failed.
5. **Calendar mapping was written only after the provider operation.** The deterministic event address is now saved before a Google write, allowing recovery to locate a potentially created entry after an interrupted request.

Existing access tokens without a session ID require reauthentication or refresh. The session ID index is sparse so legacy session documents without that field do not prevent index creation.

## Requirements coverage

“Verified” below means the stated path is covered by the local automated checks. “Implemented/reviewed” means code exists and was inspected, without claiming exhaustive live testing.

| Brief area | Status and evidence |
| --- | --- |
| Next.js App Router, NestJS, MongoDB, TypeScript monorepo | Verified builds and real database tests; npm workspaces |
| Tailwind, reusable UI primitives, Lucide, Query, RHF/Zod, Sonner, Motion | Implemented; rendered in Chrome |
| Registration, password confirmation, team selection | Verified through API and browser; permanent Bride/Groom profiles |
| Duplicate email / incorrect password / missing authentication | Verified rejection responses |
| HttpOnly cookies, refresh rotation | Implemented; refresh replay rejected; browser recovery without access cookie passes |
| Logout / password change | Verified old access and refresh rejection after the fixes |
| Profile name editing and permanent team | Verified via browser and API; team override rejected |
| Groom and Bride event creation | Verified backend derives team from authenticated profile |
| Opposite-team event modification restrictions | Verified forbidden responses; opposite-team UI read-only controls |
| Same-team collaboration by a second user | Verified teammate edit, task creation/deletion and event deletion |
| Event CRUD | Verified create, edit, detail, delete through browser/API |
| Date order, timezone, MongoDB IDs, null validation | Verified invalid requests rejected |
| UTC storage and event-local formatting | Implemented/reviewed; create/edit browser flow uses Asia/Kolkata |
| Team/title/period/date filtering and pagination | Implemented; team/title/pagination tests pass; arbitrary date combinations not exhaustively exercised |
| Dashboard own/other/joined/task totals | Server aggregation implemented; dashboard renders; every aggregate combination not exhaustively asserted |
| Wishlist add/edit/delete/complete/reopen | Verified API; browser add/complete; stored attribution/timestamps checked |
| Cross-event wishlist IDs | Verified update rejects a task ID belonging to another event |
| Opposite-team wishlist restrictions | Verified read allowed, writes rejected; disabled browser checkbox |
| Completion percentage and empty wishlists | Implemented; browser checks 1/1 and 100% workflow |
| Upload type and size rejection | Verified against the running API from Playwright: fake image rejected and >5 MB rejected |
| Successful Cloudinary storage, preview and display | Implemented/reviewed; live upload blocked by missing credentials |
| Join either team, creator auto-join, duplicate prevention | Verified; compound unique index and concurrent join tests |
| Leaving and joined-event views | Verified API and browser |
| Past events | Verified creator participation when recording a past event; new joins rejected; creator can leave |
| Google OAuth authorization code flow | Implemented/reviewed; forged state rejected before token exchange |
| Google token encryption | Verified AES-GCM round trip and tamper rejection |
| Pending participation without calendar | Verified; participation remains saved |
| Per-user calendar IDs and duplicate prevention | Verified provider tests and real MongoDB job test for both teams |
| Update all participants / leave / delete propagation | Verified real job/database flow with mocked provider |
| Retry backoff, deterministic IDs and rejoin generation | Verified unit cases; interrupted-provider mapping regression added |
| Revoked credentials | Verified disconnect state and preservation behavior with mocks; real reconnect pending |
| Calendar month/week, team/joined controls | Implemented; month/week switching verified in browser |
| All requested page routes | Build includes all routes; selected flows exercised in Chrome |
| Responsive navigation and mobile overflow | Verified at 390px; desktop tested in Chrome |
| Dialogs, labeled controls, loading, errors, empty states | Implemented/reviewed; selected dialogs and validation messages exercised |
| CORS/Origin guard, rate limits, Helmet, DTO whitelist | Implemented; untrusted-origin and unauthorized payload rejection tested; distributed limits not validated |
| Swagger API documentation | Generated endpoint/schema documentation implemented; interactive mutation limitation documented in README |
| Seed script and environment examples | Present; seeded local data used by browser checks |
| Docker and deployment instructions | Present; Compose parses; actual container launch and HTTPS behavior pending |

## Remaining engineering findings

These are concrete limitations from source review, beyond missing external credentials. They prevent an unqualified “everything is production-ready” statement:

- **Writes across collections are not transactional.** Creating an event, creating its creator participation, and enqueueing work happen separately. A database/process failure between those steps can leave partial state. Similar authorization/read-then-write races exist if an event is deleted concurrently with adding a task or joining. The tests cover normal operation and concurrent joins, not all such interruption schedules. A replica-set transaction strategy or explicit recovery/compensation is still needed for strict atomicity.
- **Calendar disconnect and in-flight synchronization need further coordination.** Disconnect decides whether credentials can be erased based on currently stored mappings. A worker that already loaded credentials can race that decision while creating an entry. Although IDs are now persisted before provider writes, this alone does not close every disconnect/worker interleaving. Per-user lifecycle coordination and a test that pauses an actual worker at that boundary are needed.
- **Worker leases have no renewal/fencing.** A long provider call or a stalled process can outlive the two-minute lease. Another instance can then claim the job while the first still operates. Deterministic IDs reduce duplicate insert risk but do not prove correct ordering for update/delete races. Multi-instance fault-injection tests and lease ownership checks remain necessary.
- **Calendar renders event start dates.** A multi-day event is currently shown on its starting day, and an event that starts outside the selected period but overlaps it is omitted. The brief does not specify multi-day rendering, but this is a limitation if such events are expected.
- **Refresh rotation rejects reuse but has no session-family compromise detection.** A replay is denied; it does not automatically revoke a newer rotated session family. Browser refresh is deduplicated within one tab, not coordinated across tabs.
- **Large-scale and accessibility coverage is limited.** No load test, formal accessibility audit, Safari/Firefox verification, or production monitoring/backup restore test was run.

## How to reproduce

```sh
npm run db                 # terminal 1; real local MongoDB, persistent .local data
npm run dev                # terminal 2
npm test
PLAYWRIGHT_CHANNEL=chrome TEST_PASSWORD='your-seed-password' npm run test:e2e
npm run typecheck
npm run build
npm audit --omit=dev --json
docker compose config --quiet
```

On macOS, prefix test/build commands with `caffeinate -i` if the machine sleeps during execution. The assertion lasts only while the command runs.

Browser tests use a development database. They remove their own `Browser celebration ...` test events and create timestamped `audit-...@example.com` accounts for registration/password tests. Those accounts remain in the local database; no account-deletion API exists. Local screenshots are in `.local/screenshots/`. Servers started for this audit are stopped afterward; data is retained.

# Deploy to Vercel + Render

This repository includes a Vercel configuration at `apps/frontend/vercel.json` and a Render Blueprint at `render.yaml`. These files prepare the deployment; they do not create accounts, connect GitHub, provision Atlas, or publish the application automatically.

## Architecture

```text
Browser → https://YOUR-FRONTEND.vercel.app
          ├── pages: Next.js on Vercel
          └── /api/* → https://YOUR-API.onrender.com/*
                        ├── NestJS API + calendar job worker
                        ├── MongoDB Atlas
                        ├── Google Calendar API
                        └── Cloudinary
```

The `/api` proxy keeps authentication cookies on the frontend origin, so the default `vercel.app` and `onrender.com` hostnames work together with SameSite=Lax. Google consent must return to the frontend's `/api/google-calendar/callback` for the state cookie to accompany the callback. Both session cookies and the OAuth nonce remain HttpOnly. API responses are marked `private, no-store`.

No custom domain is required for this setup. Keep using one stable frontend production URL: `FRONTEND_URL` is an exact allowed origin, without a trailing slash. Arbitrary Vercel preview domains are intentionally not authorized against the production API; use a separate staging backend/database for previews.

## 1. Push the repository to GitHub

Commit the source, `package-lock.json`, `render.yaml`, and `apps/frontend/vercel.json`. Do not commit `.env`, `.env.local`, `.env.production`, `.local/`, or generated deployment credentials. The ignore rules cover those paths. The production example files contain placeholders only.

The application targets Node.js 24 through package `engines`, `.node-version`, and the Render Blueprint.

## 2. Prepare MongoDB Atlas

Create an Atlas cluster and an application database user. Copy its driver connection string, insert its credentials and an explicit database name such as `everafter`. Percent-encode special characters in usernames/passwords. Allow the Render service's outbound IP ranges in Atlas Network Access (Render shows them in the service dashboard). Use a database separate from development/tests.

Use Atlas for persistent production data. Do not use `npm run db`, `mongodb-memory-server`, or the demo seed script as a hosting startup command.

## 3. Create the Vercel project and choose its production URL

Import the GitHub repository into Vercel:

| Setting                                     | Value                                                  |
| ------------------------------------------- | ------------------------------------------------------ |
| Framework                                   | Next.js                                                |
| Root Directory                              | `apps/frontend`                                        |
| Include source files outside Root Directory | Enabled (shared workspace and root lockfile)           |
| Node.js                                     | 24.x                                                   |
| Install command                             | Set by vercel.json: `cd ../.. && npm ci --include=dev` |
| Build command                               | Set by vercel.json: `npm run build`                    |
| Output                                      | `.next`                                                |

Reserve/record the project's stable production domain. You can finish its environment values and deploy after creating Render. If the first Vercel build starts before `API_PROXY_URL` is set, it intentionally fails with a configuration message; set it and redeploy.

## 4. Create the Render backend from the Blueprint

In Render, choose **New → Blueprint**, connect the GitHub repository and use the root `render.yaml`. It creates one **paid Starter web service** named `everafter-api`. Review Render's current pricing before creating the service. Starter keeps the API/worker running; changing it to Free allows idle suspension, which pauses calendar synchronization.

The Blueprint sets:

- Build: `npm ci --include=dev && npm run build -w @everafter/backend`
- Start: `npm run start -w @everafter/backend`
- Root: repository root (leave Render's Root Directory empty)
- Health check: `/health`, which checks MongoDB connectivity
- `NODE_ENV=production`, Node 24, one instance
- Independent generated JWT access and refresh secrets

Supply these prompted environment variables:

| Variable                      | Value                              |
| ----------------------------- | ---------------------------------- |
| `MONGODB_URI`                 | Your Atlas connection string       |
| `FRONTEND_URL`                | `https://YOUR-FRONTEND.vercel.app` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | 64 hex characters, generated once  |

Generate the encryption key locally, then paste it into Render's secret environment field:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep that encryption key stable across deployments so stored Google tokens remain readable. Never use Render's generic generated string for this variable: the app specifically expects 32 bytes encoded as hex. JWT secrets are generated automatically and do not have that encoding requirement.

Render supplies `PORT`; the API listens on `0.0.0.0`. You do not need `BACKEND_URL` for this deployment. Optional integration variables can be added later; login and event planning work before those integrations are configured.

Wait for `https://YOUR-API.onrender.com/health` to return `{"status":"ok"}`. If it does not, check Atlas connectivity, environment variables and build logs.

## 5. Finish Vercel environment setup and deploy

Set these in Vercel's **Production** environment:

```dotenv
API_PROXY_URL=https://YOUR-API.onrender.com
NEXT_PUBLIC_API_URL=/api
```

`API_PROXY_URL` is a server/build-time value containing the Render HTTPS origin only, with no credentials, query or path. `NEXT_PUBLIC_API_URL` is browser-visible and must remain `/api` for this architecture. Do not put database credentials, JWT secrets, Google secrets or Cloudinary secrets in Vercel/public variables.

Deploy or redeploy Vercel. Rewrites and public environment values are compiled during the build; changing them requires another deployment. Visit `https://YOUR-FRONTEND.vercel.app/api/health` and confirm the same healthy response. Then register and sign in through the frontend.

## 6. Enable Google Calendar and image uploads

In Render, add:

```dotenv
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://YOUR-FRONTEND.vercel.app/api/google-calendar/callback
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Enable Google Calendar API and configure the OAuth consent screen. Add the **exact frontend callback URL above** to the Google Web Application OAuth client's authorized redirect URIs. Use your test Google account while the consent screen is in testing mode. The backend automatically scopes the nonce cookie to `/api/google-calendar` for this callback.

Do not set the callback to the Render domain when using the Vercel proxy: that domain will not receive the browser's frontend OAuth state cookie. When changing domains, update Render's `FRONTEND_URL`, `GOOGLE_REDIRECT_URI`, and Google's authorized redirect URI together, then reconnect from a fresh consent attempt.

Upload credentials remain on Render. Image content is sent through Vercel's external rewrite to the API; verify a real JPEG/PNG/WebP upload after hosting. The API accepts up to 5 MB; platform proxy/request limits can impose a smaller effective limit and must be checked on the deployed service.

## 7. Hosted smoke checks

1. Direct Render `/health` and proxied Vercel `/api/health` return 200.
2. Register one Groom and one Bride user; sign out/in and refresh the page.
3. Create an event, edit a same-team wishlist, verify opposite-team writes return 403, and join/leave from both teams.
4. In browser Network tools, requests use the frontend `/api/...` paths. Session cookies are HttpOnly, Secure and SameSite=Lax, without an explicit shared Domain.
5. Connect Google, join an event and verify one entry appears. Edit, leave/rejoin, and delete while checking the calendar. Verify state-cookie cleanup after callback.
6. Upload a real image. Check oversize/type rejection and actual image display.
7. Check that private API responses have `Cache-Control: private, no-store` and that two browsers never share profile data.
8. Inspect Render's rate-limit behavior through the deployed Vercel/Render proxy chain. Proxy IP forwarding must be verified before enabling broad production traffic; the current default guard uses the request IP and does not blindly trust arbitrary forwarding headers.

Local proxy regression:

```sh
# Terminal 1
npm run db
# Terminal 2 (environment overrides the existing local .env files)
NEXT_PUBLIC_API_URL=/api API_PROXY_URL=http://localhost:4000 GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-calendar/callback npm run dev
# Terminal 3
TEST_API_PROXY=1 PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- e2e/deployment-proxy.spec.ts
```

The proxy regression creates a timestamped test account in the development database. Run it against development only. Automated tests cannot verify hosted TLS/cookie forwarding, external consent, billing or successful Cloudinary storage.

## Scope and remaining work

These configurations do not close the transaction and calendar-worker concurrency findings in [REQUIREMENTS-AUDIT.md](REQUIREMENTS-AUDIT.md). Keep one backend instance and treat the first hosted deployment as staging until those findings and live integrations are signed off. Render deployments can briefly overlap processes during handover, so a single configured instance is not proof against every worker race.

The existing Docker configuration remains available for local/container hosting; Vercel and this Render Blueprint use native Node builds. Neither service should run MongoDB locally. No hosting credentials or real secrets are stored in deployment files.

Official references:

- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel external rewrites](https://vercel.com/docs/routing/rewrites)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render Node.js versions](https://render.com/docs/node-version)
- [Render free-service limits](https://render.com/docs/free)

## Local verification of these deployment changes

Both production builds passed, all 37 backend tests passed, and the dedicated Chrome proxy test passed. The browser test verified `/api/health`, separate Set-Cookie headers, registration/profile/logout, rejected untrusted Origin requests, and no-store headers through the real Next.js-to-NestJS proxy. Production Vercel configuration was checked for the HTTPS rewrite and output mode. JSON/YAML parsing passed. These checks do not claim that a hosted Vercel or Render deployment has been created or tested.

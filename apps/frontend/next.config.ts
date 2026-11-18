import type { NextConfig } from "next";

// External rewrites run at the hosting edge on Vercel, keeping cookies first-party.
// The destination is fixed at build time, so changing it requires a redeploy.
const backend =
  process.env.API_PROXY_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:4000"
    : undefined);
if (process.env.VERCEL && !backend) {
  throw new Error(
    "Set API_PROXY_URL to your Render service origin before deploying.",
  );
}
if (backend) {
  const url = new URL(backend);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "API_PROXY_URL must be an HTTP(S) origin without credentials or a path.",
    );
  }
  if (process.env.VERCEL && url.protocol !== "https:") {
    throw new Error("API_PROXY_URL must use HTTPS on Vercel.");
  }
}
const config: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  async rewrites() {
    return backend
      ? [
          {
            source: "/api/:path*",
            destination: `${new URL(backend).origin}/:path*`,
          },
        ]
      : [];
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};
export default config;

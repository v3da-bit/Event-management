import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
if (!existsSync("apps/backend/.env")) {
  const example = readFileSync("apps/backend/.env.example", "utf8");
  writeFileSync(
    "apps/backend/.env",
    example
      .replace(
        "JWT_ACCESS_SECRET=",
        "JWT_ACCESS_SECRET=" + randomBytes(48).toString("hex"),
      )
      .replace(
        "JWT_REFRESH_SECRET=",
        "JWT_REFRESH_SECRET=" + randomBytes(48).toString("hex"),
      )
      .replace(
        "GOOGLE_TOKEN_ENCRYPTION_KEY=",
        "GOOGLE_TOKEN_ENCRYPTION_KEY=" + randomBytes(32).toString("hex"),
      ),
    { mode: 0o600 },
  );
  console.log("Created backend environment with unique local secrets.");
}
if (!existsSync("apps/frontend/.env.local")) {
  writeFileSync(
    "apps/frontend/.env.local",
    readFileSync("apps/frontend/.env.example"),
  );
  console.log("Created frontend environment.");
}

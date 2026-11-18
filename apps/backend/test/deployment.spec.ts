import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { ServiceUnavailableException } from "@nestjs/common";
import { CalendarController } from "../src/google-calendar/calendar.controller";
import { HealthController } from "../src/common/health.controller";

describe("Deployment health and OAuth proxy", () => {
  it("returns a healthy status only after MongoDB responds", async () => {
    const command = jest.fn().mockResolvedValue({ ok: 1 });
    const health = new HealthController({
      readyState: 1,
      db: { admin: () => ({ command }) },
    } as any);
    await expect(health.ready()).resolves.toEqual({ status: "ok" });
    expect(command).toHaveBeenCalledWith({ ping: 1 }, { timeoutMS: 2000 });
    command.mockRejectedValueOnce(new Error("connection failed"));
    await expect(health.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it("reports an unavailable database without exposing connection details", async () => {
    const health = new HealthController({ readyState: 0 } as any);
    await expect(health.ready()).rejects.toThrow("Database unavailable");
  });
  it.each(["/google-calendar", "/api/google-calendar"])(
    "sets and clears the OAuth state cookie at the browser-visible path %s",
    async (path) => {
      const config = new ConfigService({
        NODE_ENV: "production",
        FRONTEND_URL: "https://wedding.vercel.app",
        GOOGLE_REDIRECT_URI: `https://wedding.vercel.app${path}/callback`,
        JWT_ACCESS_SECRET: "test-only-access-key-at-least-thirty-two-chars",
      });
      const jwt = new JwtService();
      const calendar = {
        connectUrl: jest.fn(
          (_state: string) => "https://accounts.google.com/oauth",
        ),
        connect: jest.fn().mockResolvedValue(undefined),
      };
      const controller = new CalendarController(calendar as any, config, jwt);
      const response = {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
        redirect: jest.fn(),
      };
      controller.connect({ user: { id: "user-1" } }, response as any);
      const nonce = response.cookie.mock.calls[0][1];
      expect(response.cookie).toHaveBeenCalledWith(
        "oauth_state",
        nonce,
        expect.objectContaining({
          path,
          secure: true,
          httpOnly: true,
          sameSite: "lax",
        }),
      );
      const state = calendar.connectUrl.mock.calls[0]?.[0];
      await controller.callback(
        "code",
        state,
        { cookies: { oauth_state: nonce } },
        response as any,
      );
      expect(calendar.connect).toHaveBeenCalledWith("user-1", "code");
      expect(response.clearCookie).toHaveBeenCalledWith("oauth_state", {
        path,
      });
      expect(response.redirect).toHaveBeenLastCalledWith(
        "https://wedding.vercel.app/settings?calendar=connected",
      );
    },
  );
});

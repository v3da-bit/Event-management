import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getModelToken } from "@nestjs/mongoose";
import cookieParser from "cookie-parser";
import request from "supertest";
import { Model } from "mongoose";
import { google } from "googleapis";
import { AppModule } from "../src/app.module";
import { CalendarService } from "../src/google-calendar/calendar.service";
const origin = "http://localhost:3000";
describe("Wedding API with real MongoDB", () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let groom: string[];
  let bride: string[];
  let eventId: string;
  let brideEvent: string;
  let itemId: string;
  let calendar: CalendarService;
  const password = "StrongPassword123";
  const cookies = (res: any) =>
    (res.headers["set-cookie"] as unknown as string[]).map(
      (c) => c.split(";")[0],
    );
  const call = (
    method: "get" | "post" | "patch" | "delete",
    path: string,
    auth?: string[],
  ) => {
    const req = request(app.getHttpServer())
      [method](path)
      .set("Origin", origin);
    return auth ? req.set("Cookie", auth) : req;
  };
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    process.env.FRONTEND_URL = origin;
    process.env.JWT_ACCESS_SECRET =
      "test-access-secret-at-least-thirty-two-characters";
    process.env.JWT_REFRESH_SECRET =
      "test-refresh-secret-at-least-thirty-two-characters";
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    calendar = app.get(CalendarService);
    calendar.onModuleDestroy();
    for (const name of ["User", "Participant", "Session", "SyncJob"])
      await app.get<Model<any>>(getModelToken(name)).init();
  });
  afterAll(async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
  });
  it("registers immutable Groom and Bride teams without exposing password hashes", async () => {
    const g = await call("post", "/auth/register")
      .send({
        fullName: "Test Groom",
        email: "groom@test.com",
        password,
        team: "GROOM",
      })
      .expect(201);
    groom = cookies(g);
    expect(g.body.team).toBe("GROOM");
    expect(g.body.passwordHash).toBeUndefined();
    const b = await call("post", "/auth/register")
      .send({
        fullName: "Test Bride",
        email: "bride@test.com",
        password,
        team: "BRIDE",
      })
      .expect(201);
    bride = cookies(b);
    expect(b.body.team).toBe("BRIDE");
    await call("patch", "/users/me", groom).send({ team: "BRIDE" }).expect(400);
  });
  it("prevents duplicates, rejects bad credentials and authenticates login", async () => {
    await call("post", "/auth/register")
      .send({
        fullName: "Again",
        email: "GROOM@test.com",
        password,
        team: "GROOM",
      })
      .expect(409);
    await call("post", "/auth/login")
      .send({ email: "groom@test.com", password: "wrong" })
      .expect(401);
    const res = await call("post", "/auth/login")
      .send({ email: "groom@test.com", password })
      .expect(200);
    expect(res.body.fullName).toBe("Test Groom");
    await call("get", "/events").expect(401);
  });
  it("rotates refresh cookies once and rejects replay", async () => {
    const login = await call("post", "/auth/login").send({
      email: "groom@test.com",
      password,
    });
    const original = cookies(login);
    const rotated = await call("post", "/auth/refresh", original).expect(200);
    expect(cookies(rotated)).not.toEqual(original);
    await call("post", "/auth/refresh", original).expect(401);
  });
  it("protects cookie-authenticated mutations from other origins", async () => {
    await request(app.getHttpServer())
      .post("/events")
      .set("Cookie", groom)
      .set("Origin", "http://evil.example")
      .send({})
      .expect(403);
  });
  const dto = {
    title: "Wedding ceremony",
    description: "Our big day",
    startDate: "2099-02-15T04:30:00Z",
    endDate: "2099-02-15T07:30:00Z",
    timezone: "Asia/Kolkata",
  };
  it("creates events using the authenticated team and auto-joins the creator", async () => {
    const g = await call("post", "/events", groom).send(dto).expect(201);
    eventId = g.body._id;
    expect(g.body.team).toBe("GROOM");
    expect(g.body.joined).toBe(true);
    expect(g.body.participantCount).toBe(1);
    const b = await call("post", "/events", bride)
      .send({ ...dto, title: "Mehendi" })
      .expect(201);
    brideEvent = b.body._id;
    expect(b.body.team).toBe("BRIDE");
    await call("post", "/events", groom)
      .send({ ...dto, team: "BRIDE" })
      .expect(400);
  });
  it("rejects invalid dates, timezones and malformed IDs", async () => {
    await call("post", "/events", groom)
      .send({ ...dto, endDate: "2000-01-01T00:00:00Z" })
      .expect(400);
    await call("post", "/events", groom)
      .send({ ...dto, timezone: "Invalid/Zone" })
      .expect(400);
    await call("get", "/events/not-an-id", groom).expect(400);
  });
  it("compares full timestamps for same-day creation and partial time edits", async () => {
    const startDate = "2099-02-15T10:00:00+05:30";
    for (const endDate of [startDate, "2099-02-15T09:59:00+05:30"])
      await call("post", "/events", groom)
        .send({ ...dto, startDate, endDate })
        .expect(400);
    const created = await call("post", "/events", groom)
      .send({ ...dto, startDate, endDate: "2099-02-15T10:01:00+05:30" })
      .expect(201);
    const path = `/events/${created.body._id}`;
    expect(created.body.startDate).toBe("2099-02-15T04:30:00.000Z");
    expect(created.body.endDate).toBe("2099-02-15T04:31:00.000Z");
    // Equal instants must be rejected even when their written offsets differ.
    await call("patch", path, groom)
      .send({ endDate: "2099-02-15T04:30:00Z" })
      .expect(400);
    await call("patch", path, groom)
      .send({ startDate: "2099-02-15T10:02:00+05:30" })
      .expect(400);
    await call("patch", path, groom)
      .send({ endDate: "2099-02-15T11:00:00+05:30" })
      .expect(200);
    // Crossing midnight remains valid; compare dates as well as clock times.
    await call("patch", path, groom)
      .send({
        startDate: "2099-02-15T23:30:00+05:30",
        endDate: "2099-02-16T00:30:00+05:30",
      })
      .expect(200);
    await call("delete", path, groom).expect(200);
  });
  it("blocks cross-team edits and deletions but permits reads", async () => {
    await call("patch", `/events/${brideEvent}`, groom)
      .send({ title: "Unauthorized" })
      .expect(403);
    await call("delete", `/events/${eventId}`, bride).expect(403);
    await call("get", `/events/${brideEvent}`, groom).expect(200);
  });
  it("enforces wishlist ownership and records completion/reopening", async () => {
    const item = await call("post", `/events/${eventId}/wishlist`, groom)
      .send({ title: "Book photographer", description: "For the ceremony" })
      .expect(201);
    itemId = item.body._id;
    await call("get", `/events/${eventId}/wishlist`, bride).expect(200);
    await call("patch", `/events/${eventId}/wishlist/${itemId}`, bride)
      .send({ title: "Unauthorized edit" })
      .expect(403);
    await call("delete", `/events/${eventId}/wishlist/${itemId}`, bride).expect(
      403,
    );
    await call("patch", `/events/${eventId}/wishlist/${itemId}`, groom)
      .send({ description: "Updated detail" })
      .expect(200);
    await call("post", `/events/${eventId}/wishlist`, bride)
      .send({ title: "No" })
      .expect(403);
    await call("patch", `/events/${eventId}/wishlist/${itemId}/toggle`, bride)
      .send({ isCompleted: true })
      .expect(403);
    const done = await call(
      "patch",
      `/events/${eventId}/wishlist/${itemId}/toggle`,
      groom,
    )
      .send({ isCompleted: true })
      .expect(200);
    expect(done.body.completedAt).toBeTruthy();
    expect(done.body.completedBy).toBeTruthy();
    const opened = await call(
      "patch",
      `/events/${eventId}/wishlist/${itemId}/toggle`,
      groom,
    )
      .send({ isCompleted: false })
      .expect(200);
    expect(opened.body.isCompleted).toBe(false);
    expect(opened.body.completedAt).toBeNull();
  });
  it("allows joining the other team, prevents concurrent duplicates and supports leaving", async () => {
    await Promise.all([
      call("post", `/events/${eventId}/join`, bride).expect(201),
      call("post", `/events/${eventId}/join`, bride).expect(201),
    ]);
    const detail = await call("get", `/events/${eventId}`, bride);
    expect(detail.body.participantCount).toBe(2);
    expect(detail.body.joined).toBe(true);
    expect(detail.body.syncStatus).toBe("PENDING");
    const joined = await call("get", "/events/joined", bride);
    expect(joined.body.total).toBe(2);
    await call("delete", `/events/${eventId}/leave`, bride).expect(200);
    const left = await call("get", `/events/${eventId}`, bride);
    expect(left.body.joined).toBe(false);
  });
  it("filters and paginates events", async () => {
    const res = await call(
      "get",
      "/events?team=BRIDE&search=Mehendi&limit=1",
      groom,
    );
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].team).toBe("BRIDE");
  });
  it("encrypts Google refresh tokens with tamper detection", () => {
    const value = calendar.encrypt("secret-token");
    expect(value).not.toContain("secret-token");
    expect(calendar.decrypt(value)).toBe("secret-token");
    expect(() => calendar.decrypt(value.slice(0, -2) + "ff")).toThrow();
  });
  it("queues updates and deletions durably, hides deleted events and keeps deletion idempotent", async () => {
    await call("patch", `/events/${eventId}`, groom)
      .send({ title: "Updated ceremony" })
      .expect(200);
    const jobs = app.get<Model<any>>(getModelToken("SyncJob"));
    expect(await jobs.countDocuments()).toBeGreaterThan(0);
    await call("delete", `/events/${eventId}`, groom).expect(200);
    await call("get", `/events/${eventId}`, groom).expect(404);
    await call("delete", `/events/${eventId}`, groom).expect(200);
    expect(
      await app
        .get<Model<any>>(getModelToken("Wishlist"))
        .countDocuments({ eventId }),
    ).toBe(0);
  });
  it("supports recording past events with creator participation but rejects new joins", async () => {
    const past = await call("post", "/events", groom)
      .send({
        ...dto,
        title: "Past celebration",
        startDate: "2000-01-01T10:00:00Z",
        endDate: "2000-01-01T13:00:00Z",
      })
      .expect(201);
    expect(past.body.joined).toBe(true);
    await call("post", `/events/${past.body._id}/join`, bride).expect(400);
    await call("delete", `/events/${past.body._id}/leave`, groom).expect(200);
  });
  it("rejects null required fields on partial event, wishlist and profile updates", async () => {
    const e = await call("post", "/events", groom).send(dto).expect(201);
    for (const field of [
      "title",
      "description",
      "startDate",
      "endDate",
      "timezone",
    ]) {
      await call("patch", `/events/${e.body._id}`, groom)
        .send({ [field]: null })
        .expect(400);
    }
    const task = await call("post", `/events/${e.body._id}/wishlist`, groom)
      .send({ title: "Keep this title" })
      .expect(201);
    await call(
      "patch",
      `/events/${e.body._id}/wishlist/${task.body._id}`,
      groom,
    )
      .send({ title: null })
      .expect(400);
    await call("patch", "/users/me", groom)
      .send({ fullName: null })
      .expect(400);
    await call("patch", `/events/${e.body._id}`, groom)
      .send({ coverImage: null })
      .expect(200);
  });
  it("revokes access as well as refresh tokens on logout", async () => {
    const login = await call("post", "/auth/login")
      .send({ email: "groom@test.com", password })
      .expect(200);
    const session = cookies(login);
    await call("post", "/auth/logout", session).expect(200);
    await call("get", "/auth/me", session).expect(401);
    await call("post", "/auth/refresh", session).expect(401);
  });

  it("allows another member of the owning team to manage events and tasks", async () => {
    const teammate = await call("post", "/auth/register")
      .send({
        fullName: "Other Groom",
        email: "other@test.com",
        password,
        team: "GROOM",
      })
      .expect(201);
    const auth = cookies(teammate);
    const event = await call("post", "/events", groom).send(dto).expect(201);
    await call("patch", `/events/${event.body._id}`, auth)
      .send({ title: "Team collaboration" })
      .expect(200);
    const task = await call("post", `/events/${event.body._id}/wishlist`, auth)
      .send({ title: "Shared task" })
      .expect(201);
    await call(
      "delete",
      `/events/${event.body._id}/wishlist/${task.body._id}`,
      auth,
    ).expect(200);
    await call("delete", `/events/${event.body._id}`, auth).expect(200);
  });
  it("rejects cross-event wishlist IDs and invalid filter pagination", async () => {
    const first = await call("post", "/events", groom).send(dto).expect(201);
    const second = await call("post", "/events", groom).send(dto).expect(201);
    const task = await call("post", `/events/${first.body._id}/wishlist`, groom)
      .send({ title: "Scoped task" })
      .expect(201);
    await call(
      "patch",
      `/events/${second.body._id}/wishlist/${task.body._id}`,
      groom,
    )
      .send({ title: "Wrong event" })
      .expect(404);
    await call("get", "/events?limit=101", groom).expect(400);
    await call("get", "/events?page=0", groom).expect(400);
  });
  it("validates OAuth state before attempting a token exchange", async () => {
    const spy = jest.spyOn(calendar, "connect");
    const response = await call(
      "get",
      "/google-calendar/callback?code=bad&state=forged",
    ).expect(302);
    expect(response.headers.location).toBe(origin + "/settings?calendar=error");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("propagates create/update/leave/delete through persistent jobs for both connected teams", async () => {
    const users = app.get<Model<any>>(getModelToken("User"));
    const participants = app.get<Model<any>>(getModelToken("Participant"));
    const connected = await users.find({
      email: { $in: ["groom@test.com", "bride@test.com"] },
    });
    for (const user of connected)
      await users.updateOne(
        { _id: user._id },
        {
          googleCalendarConnected: true,
          googleAccountId: String(user._id),
          googleRefreshTokenEncrypted: calendar.encrypt("test-provider-token"),
        },
      );
    const entries = new Map<string, any>();
    const provider = {
      events: {
        update: jest.fn(async ({ eventId, requestBody }: any) => {
          if (!entries.has(eventId)) throw { code: 404 };
          entries.set(eventId, requestBody);
          return {};
        }),
        insert: jest.fn(async ({ requestBody }: any) => {
          if (entries.has(requestBody.id)) throw { code: 409 };
          entries.set(requestBody.id, requestBody);
          return {};
        }),
        delete: jest.fn(async ({ eventId }: any) => {
          entries.delete(eventId);
          return {};
        }),
      },
    };
    const oauth = jest
      .spyOn(calendar, "oauth")
      .mockReturnValue({ setCredentials: jest.fn() } as any);
    const googleApi = jest
      .spyOn(google, "calendar")
      .mockReturnValue(provider as any);
    const drain = async () => {
      for (let i = 0; i < 5; i++) await calendar.work();
    };
    try {
      const created = await call("post", "/events", groom)
        .send(dto)
        .expect(201);
      const id = created.body._id;
      await call("post", `/events/${id}/join`, bride).expect(201);
      await drain();
      let rows = await participants.find({ eventId: id });
      expect(rows).toHaveLength(2);
      expect(rows.every((p) => p.syncStatus === "SYNCED")).toBe(true);
      expect(new Set(rows.map((p) => p.googleCalendarEventId)).size).toBe(2);
      await call("post", `/events/${id}/join`, bride).expect(201);
      await drain();
      expect(
        [...entries.values()].filter(
          (e) => e.extendedProperties.private.everafterEventId === id,
        ),
      ).toHaveLength(2);
      await call("patch", `/events/${id}`, groom)
        .send({ title: "Calendar update" })
        .expect(200);
      await drain();
      for (const p of rows)
        expect(entries.get(p.googleCalendarEventId).summary).toBe(
          "Calendar update",
        );
      await call("delete", `/events/${id}/leave`, bride).expect(200);
      await drain();
      expect(
        [...entries.values()].filter(
          (e) => e.extendedProperties.private.everafterEventId === id,
        ),
      ).toHaveLength(1);
      await call("delete", `/events/${id}`, groom).expect(200);
      await drain();
      for (const p of rows)
        expect(entries.has(p.googleCalendarEventId)).toBe(false);
    } finally {
      oauth.mockRestore();
      googleApi.mockRestore();
      await users.updateMany(
        { _id: { $in: connected.map((u) => u._id) } },
        {
          googleCalendarConnected: false,
          $unset: { googleRefreshTokenEncrypted: 1 },
        },
      );
    }
  });
  it("revokes all existing access and refresh sessions on password change", async () => {
    await call("patch", "/users/me/password", groom)
      .send({ currentPassword: password, newPassword: "NewStrongPassword123" })
      .expect(200);
    await call("get", "/auth/me", groom).expect(401);
    await call("post", "/auth/refresh", groom).expect(401);
  });
});

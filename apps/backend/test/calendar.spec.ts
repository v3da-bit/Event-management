import "reflect-metadata";
import { CalendarService } from "../src/google-calendar/calendar.service";
import { ConfigService } from "@nestjs/config";
import { google } from "googleapis";
jest.mock("googleapis", () => ({
  google: { calendar: jest.fn(), auth: { OAuth2: jest.fn() } },
}));
describe("Google Calendar synchronization", () => {
  let service: CalendarService;
  let users: any;
  let participants: any;
  let events: any;
  let jobs: any;
  let provider: any;
  let p: any;
  let user: any;
  let event: any;
  beforeEach(() => {
    p = {
      _id: "participant-1",
      userId: "user-1",
      eventId: "event-1",
      active: true,
    };
    user = {
      _id: "user-1",
      googleCalendarConnected: true,
      googleAccountId: "google-1",
      googleRefreshTokenEncrypted: "encrypted",
    };
    event = {
      _id: "event-1",
      title: "Ceremony",
      description: "Details",
      startDate: new Date("2099-02-15T04:30:00Z"),
      endDate: new Date("2099-02-15T07:30:00Z"),
      timezone: "Asia/Kolkata",
    };
    users = {
      findById: jest.fn(() => ({ select: () => Promise.resolve(user) })),
      updateOne: jest.fn(),
    };
    participants = {
      findById: jest.fn(async () => p),
      updateOne: jest.fn(),
      exists: jest.fn(async () => false),
    };
    events = { findById: jest.fn(async () => event) };
    jobs = {};
    provider = {
      events: {
        update: jest.fn(async () => ({})),
        insert: jest.fn(async () => ({})),
        delete: jest.fn(async () => ({})),
      },
    };
    (google.calendar as jest.Mock).mockReturnValue(provider);
    service = new CalendarService(
      users,
      events,
      participants,
      jobs,
      new ConfigService(),
    );
    jest
      .spyOn(service, "oauth")
      .mockReturnValue({ setCredentials: jest.fn() } as any);
    jest.spyOn(service, "decrypt").mockReturnValue("refresh-token");
  });
  it("creates real-provider event requests with deterministic IDs and records mappings", async () => {
    provider.events.update.mockRejectedValueOnce({ code: 404 });
    await service.syncParticipant("participant-1");
    expect(provider.events.insert).toHaveBeenCalledTimes(1);
    const data = provider.events.insert.mock.calls[0][0];
    expect(data.requestBody.id).toMatch(/^[a-f0-9]{64}$/);
    expect(data.requestBody.start.timeZone).toBe("Asia/Kolkata");
    expect(participants.updateOne).toHaveBeenCalledWith(
      { _id: "participant-1" },
      expect.objectContaining({
        googleCalendarEventId: data.requestBody.id,
        syncStatus: "SYNCED",
      }),
    );
  });
  it("updates existing calendar entries without creating duplicates", async () => {
    p.googleCalendarEventId = "existing";
    await service.syncParticipant("participant-1");
    expect(provider.events.update.mock.calls[0][0].eventId).toBe("existing");
    expect(provider.events.insert).not.toHaveBeenCalled();
  });
  it("recovers from concurrent insertion conflict using the same event ID", async () => {
    provider.events.update.mockRejectedValueOnce({ code: 404 });
    provider.events.insert.mockRejectedValueOnce({ code: 409 });
    await service.syncParticipant("participant-1");
    expect(provider.events.update).toHaveBeenCalledTimes(2);
  });
  it.each(["leave", "delete", "disconnect"])(
    "removes only the app mapping on %s",
    async (reason) => {
      p.googleCalendarEventId = "app-event";
      if (reason === "leave") p.active = false;
      if (reason === "delete") event.deletedAt = new Date();
      if (reason === "disconnect") {
        user.googleCalendarConnected = false;
        user.googleCalendarDisconnectRequested = true;
      }
      await service.syncParticipant("participant-1");
      expect(provider.events.delete).toHaveBeenCalledWith({
        calendarId: "primary",
        eventId: "app-event",
      });
      expect(provider.events.insert).not.toHaveBeenCalled();
    },
  );
  it("treats already-deleted provider entries as successful cleanup", async () => {
    p.active = false;
    provider.events.delete.mockRejectedValueOnce({ code: 410 });
    await expect(
      service.syncParticipant("participant-1"),
    ).resolves.toBeUndefined();
  });
  it("marks revoked credentials disconnected and surfaces failure for persistent retry", async () => {
    provider.events.update.mockRejectedValueOnce({
      response: { data: { error: "invalid_grant" } },
    });
    await expect(service.syncParticipant("participant-1")).rejects.toBeTruthy();
    expect(users.updateOne).toHaveBeenCalledWith(
      { _id: "user-1" },
      { googleCalendarConnected: false },
    );
  });
  it("leaves participation pending when Google has never been connected", async () => {
    user.googleRefreshTokenEncrypted = undefined;
    await service.syncParticipant("participant-1");
    expect(participants.updateOne).toHaveBeenCalledWith(
      { _id: "participant-1" },
      { syncStatus: "PENDING" },
    );
    expect(provider.events.insert).not.toHaveBeenCalled();
  });
  it("uses a fresh deterministic ID when rejoining after provider deletion", async () => {
    provider.events.update.mockRejectedValueOnce({ code: 404 });
    await service.syncParticipant("participant-1");
    const firstId = provider.events.insert.mock.calls[0][0].requestBody.id;
    p.calendarGeneration = 1;
    provider.events.update.mockRejectedValueOnce({ code: 404 });
    await service.syncParticipant("participant-1");
    expect(provider.events.insert.mock.calls[1][0].requestBody.id).not.toBe(
      firstId,
    );
  });
  it("persists provider failure with retry backoff and releases its lease", async () => {
    const job = {
      _id: "job-1",
      participantId: "participant-1",
      attempts: 0,
      revision: 1,
    };
    jobs.findOneAndUpdate = jest
      .fn()
      .mockResolvedValueOnce(job)
      .mockResolvedValue(null);
    jobs.updateOne = jest.fn();
    jobs.deleteOne = jest.fn();
    participants.find = jest.fn(() => ({
      sort: () => ({ limit: async () => [] }),
    }));
    jest
      .spyOn(service, "syncParticipant")
      .mockRejectedValue(new Error("Provider unavailable"));
    await service.work();
    expect(participants.updateOne).toHaveBeenCalledWith(
      { _id: "participant-1" },
      { syncStatus: "FAILED" },
    );
    expect(jobs.updateOne).toHaveBeenCalledWith(
      { _id: "job-1" },
      {
        $set: expect.objectContaining({
          attempts: 1,
          nextAttemptAt: expect.any(Date),
          lockedUntil: new Date(0),
        }),
      },
    );
    expect(jobs.deleteOne).not.toHaveBeenCalled();
  });
  it("preserves existing entries when authorization was revoked rather than explicitly disconnected", async () => {
    user.googleCalendarConnected = false;
    user.googleCalendarDisconnectRequested = false;
    p.googleCalendarEventId = "existing";
    await expect(service.syncParticipant("participant-1")).rejects.toThrow();
    expect(provider.events.delete).not.toHaveBeenCalled();
  });
  it("records the deterministic mapping before issuing a provider write for crash recovery", async () => {
    provider.events.update.mockImplementation(async () => {
      expect(participants.updateOne).toHaveBeenCalledWith(
        { _id: "participant-1" },
        { googleCalendarEventId: expect.stringMatching(/^[a-f0-9]{64}$/) },
      );
      return {};
    });
    await service.syncParticipant("participant-1");
  });
});

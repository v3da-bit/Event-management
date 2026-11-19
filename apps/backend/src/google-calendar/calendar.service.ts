import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  ServiceUnavailableException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ConfigService } from "@nestjs/config";
import { google } from "googleapis";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "crypto";
@Injectable()
export class CalendarService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private reconcileCursor: any = null;
  private logger = new Logger(CalendarService.name);
  constructor(
    @InjectModel("User") private users: Model<any>,
    @InjectModel("Event") private events: Model<any>,
    @InjectModel("Participant") private participants: Model<any>,
    @InjectModel("SyncJob") private jobs: Model<any>,
    private config: ConfigService,
    @InjectModel("Wishlist") private wishlist: Model<any>,
  ) {}
  onModuleInit() {
    this.timer = setInterval(
      () =>
        void this.work().catch((e) =>
          this.logger.error("Calendar worker failed", e?.stack),
        ),
      3000,
    );
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  oauth() {
    const id = this.config.get("GOOGLE_CLIENT_ID");
    const secret = this.config.get("GOOGLE_CLIENT_SECRET");
    if (!id || !secret || !this.config.get("GOOGLE_TOKEN_ENCRYPTION_KEY"))
      throw new ServiceUnavailableException(
        "Google Calendar is not configured. Add OAuth credentials and encryption key to the backend environment.",
      );
    return new google.auth.OAuth2(
      id,
      secret,
      this.config.getOrThrow("GOOGLE_REDIRECT_URI"),
    );
  }
  private key() {
    const key = Buffer.from(
      this.config.getOrThrow<string>("GOOGLE_TOKEN_ENCRYPTION_KEY"),
      "hex",
    );
    if (key.length !== 32)
      throw new ServiceUnavailableException(
        "Google encryption key must be 32 bytes in hex",
      );
    return key;
  }
  encrypt(token: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return [
      iv.toString("hex"),
      cipher.getAuthTag().toString("hex"),
      data.toString("hex"),
    ].join(".");
  }
  decrypt(token: string) {
    const [iv, tag, data] = token.split(".");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key(),
      Buffer.from(iv, "hex"),
    );
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "hex")),
      decipher.final(),
    ]).toString("utf8");
  }
  connectUrl(state: string) {
    return this.oauth().generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/calendar.events.owned",
        "openid",
      ],
      state,
    });
  }
  async connect(userId: string, code: string) {
    const auth = this.oauth();
    const { tokens } = await auth.getToken(code);
    if (!tokens.refresh_token || !tokens.id_token)
      throw new BadRequestException(
        "Google did not provide offline authorization. Please reconnect.",
      );
    const identity = await auth.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.config.getOrThrow("GOOGLE_CLIENT_ID"),
    });
    const accountId = identity.getPayload()?.sub;
    const existing = await this.users.findById(userId);
    if (existing?.googleAccountId && existing.googleAccountId !== accountId)
      throw new BadRequestException(
        "Reconnect the same Google account to preserve calendar mappings",
      );
    await this.users.updateOne(
      { _id: userId },
      {
        googleCalendarConnected: true,
        googleCalendarDisconnectRequested: false,
        googleAccountId: accountId,
        googleRefreshTokenEncrypted: this.encrypt(tokens.refresh_token),
      },
    );
    await this.enqueueUser(userId);
  }
  async enqueue(participantId: any) {
    await this.jobs.updateOne(
      { participantId },
      {
        $inc: { revision: 1 },
        $set: { nextAttemptAt: new Date(), attempts: 0 },
        $setOnInsert: { lockedUntil: new Date(0) },
      },
      { upsert: true },
    );
  }
  async enqueueEvent(eventId: string) {
    const rows = await this.participants.find({ eventId });
    for (const row of rows) await this.enqueue(row._id);
  }
  async enqueueUser(userId: string) {
    const rows = await this.participants.find({ userId });
    for (const row of rows) await this.enqueue(row._id);
    return { message: "Calendar synchronization queued", count: rows.length };
  }
  async status(userId: string) {
    const user = await this.users.findById(userId);
    const counts = await this.participants.aggregate([
      { $match: { userId: user._id, active: true } },
      { $group: { _id: "$syncStatus", count: { $sum: 1 } } },
    ]);
    return {
      connected: user.googleCalendarConnected,
      configured: Boolean(
        this.config.get("GOOGLE_CLIENT_ID") &&
        this.config.get("GOOGLE_CLIENT_SECRET") &&
        this.config.get("GOOGLE_TOKEN_ENCRYPTION_KEY"),
      ),
      counts,
    };
  }
  async disconnect(userId: string) {
    const pendingCleanup = await this.participants.countDocuments({
      userId,
      googleCalendarEventId: { $exists: true },
    });
    // Keep credentials until app-owned calendar entries have been removed by the persistent worker.
    await this.users.updateOne(
      { _id: userId },
      {
        googleCalendarConnected: false,
        googleCalendarDisconnectRequested: true,
      },
    );
    await this.enqueueUser(userId);
    if (!pendingCleanup) await this.clearToken(userId);
    return {
      message: "Disconnected. App calendar entries are queued for removal.",
    };
  }
  private async clearToken(userId: any) {
    await this.users.updateOne(
      { _id: userId, googleCalendarConnected: false },
      { $unset: { googleRefreshTokenEncrypted: 1 } },
    );
  }
  async work() {
    if (this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < 20; i++) {
        const now = new Date();
        const job = await this.jobs.findOneAndUpdate(
          { nextAttemptAt: { $lte: now }, lockedUntil: { $lte: now } },
          { $set: { lockedUntil: new Date(Date.now() + 120000) } },
          { new: true },
        );
        if (!job) break;
        try {
          await this.syncParticipant(String(job.participantId));
          await this.jobs.deleteOne({ _id: job._id, revision: job.revision });
          await this.jobs.updateOne(
            { _id: job._id },
            { lockedUntil: new Date(0) },
          );
        } catch (e: any) {
          const attempts = job.attempts + 1;
          await this.participants.updateOne(
            { _id: job.participantId },
            { syncStatus: "FAILED" },
          );
          await this.jobs.updateOne(
            { _id: job._id },
            {
              $set: {
                attempts,
                lastError: "Calendar provider request failed",
                lockedUntil: new Date(0),
                nextAttemptAt: new Date(
                  Date.now() +
                    Math.min(3600000, 5000 * 2 ** Math.min(attempts, 10)),
                ),
              },
            },
          );
          this.logger.warn(
            JSON.stringify({
              message: "Calendar synchronization will retry",
              participantId: String(job.participantId),
              attempts,
              code: e.code || e.response?.status,
            }),
          );
        }
      }
      // Reconcile persisted domain state in bounded pages, including writes interrupted
      // before enqueue. Existing jobs retain their retry delay and lease.
      const candidates = await this.participants
        .find(
          this.reconcileCursor ? { _id: { $gt: this.reconcileCursor } } : {},
        )
        .sort({ _id: 1 })
        .limit(100);
      this.reconcileCursor =
        candidates.length === 100 ? candidates[99]._id : null;
      for (const p of candidates) {
        const [user, event] = await Promise.all([
          this.users.findById(p.userId),
          this.events.findById(p.eventId),
        ]);
        const remove =
          !p.active ||
          !event ||
          event.deletedAt ||
          user?.googleCalendarDisconnectRequested;
        const dirty =
          !remove &&
          user?.googleCalendarConnected &&
          (p.syncStatus !== "SYNCED" ||
            !p.lastSyncedAt ||
            event.updatedAt > p.lastSyncedAt);
        if ((remove && p.googleCalendarEventId) || dirty)
          await this.jobs.updateOne(
            { participantId: p._id },
            {
              $setOnInsert: {
                revision: 1,
                nextAttemptAt: new Date(),
                lockedUntil: new Date(0),
              },
            },
            { upsert: true },
          );
      }
    } finally {
      this.running = false;
    }
  }
  async syncParticipant(id: string) {
    const p = await this.participants.findById(id);
    if (!p) return;
    const [user, event] = await Promise.all([
      this.users.findById(p.userId).select("+googleRefreshTokenEncrypted"),
      this.events.findById(p.eventId),
    ]);
    if (!user) return;
    const remove =
      !p.active ||
      !event ||
      Boolean(event.deletedAt) ||
      user.googleCalendarDisconnectRequested;
    if (!user.googleRefreshTokenEncrypted) {
      if (!remove)
        await this.participants.updateOne(
          { _id: id },
          { syncStatus: "PENDING" },
        );
      return;
    }
    if (
      !user.googleCalendarConnected &&
      !user.googleCalendarDisconnectRequested
    )
      throw new ServiceUnavailableException(
        "Google authorization expired. Reconnect your calendar.",
      );
    const auth = this.oauth();
    auth.setCredentials({
      refresh_token: this.decrypt(user.googleRefreshTokenEncrypted),
    });
    const calendar = google.calendar({ version: "v3", auth, timeout: 30000 });
    // Deterministic Google ID makes retries idempotent even if a process dies after insertion.
    const googleId =
      p.googleCalendarEventId ||
      createHash("sha256")
        .update(
          `everafter:${p._id}:${user.googleAccountId}:${p.calendarGeneration || 0}`,
        )
        .digest("hex");
    // Persist the deterministic address before any provider request. Cleanup can then
    // find it even if the process crashes after Google accepts the write.
    if (!p.googleCalendarEventId && !remove)
      await this.participants.updateOne(
        { _id: id },
        { googleCalendarEventId: googleId },
      );
    try {
      if (remove) {
        try {
          await calendar.events.delete({
            calendarId: "primary",
            eventId: googleId,
          });
        } catch (e: any) {
          if (![404, 410].includes(e.code)) throw e;
        }
        await this.participants.updateOne(
          { _id: id },
          {
            $unset: { googleCalendarEventId: 1 },
            $inc: { calendarGeneration: 1 },
            $set: { syncStatus: "PENDING" },
          },
        );
        if (
          !user.googleCalendarConnected &&
          !(await this.participants.exists({
            userId: user._id,
            googleCalendarEventId: { $exists: true },
          }))
        )
          await this.clearToken(user._id);
        return;
      }
      const pending = await this.wishlist.find({ eventId: event._id, isCompleted: false }).sort({ createdAt: 1 }).lean();
      const mapLink = (value: any) => {
        const query = value.locationPin
          ? `${value.locationPin.lat},${value.locationPin.lng}` : value.location;
        return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
      };
      const reminderMinutes = event.reminderMinutes ?? 1440;
      const requestBody = {
        summary: event.title,
        description: [
          event.description,
          mapLink(event) ? `Event map: ${mapLink(event)}` : "",
          pending.length ? `Pending wishlist (${pending.length}):\n${pending.map(t =>
            `• ${t.title}${t.location ? ` — ${t.location}` : ""}${mapLink(t) ? `\n  ${mapLink(t)}` : ""}`
          ).join("\n")}` : "Wishlist: all details taken care of.",
          `View event: ${this.config.getOrThrow("FRONTEND_URL")}/events/${event._id}`,
        ].filter(Boolean).join("\n\n"),
        location: event.locationPin ? `${event.location ? `${event.location} — ` : ""}${event.locationPin.lat},${event.locationPin.lng}` : event.location,
        reminders: {
          useDefault: false,
          overrides: reminderMinutes > 0 ? [{ method: "popup", minutes: reminderMinutes }] : [],
        },
        start: {
          dateTime: event.startDate.toISOString(),
          timeZone: event.timezone,
        },
        end: {
          dateTime: event.endDate.toISOString(),
          timeZone: event.timezone,
        },
        extendedProperties: {
          private: { everafterEventId: String(event._id) },
        },
      };
      try {
        await calendar.events.update({
          calendarId: "primary",
          eventId: googleId,
          requestBody,
        });
      } catch (e: any) {
        if (e.code !== 404) throw e;
        try {
          await calendar.events.insert({
            calendarId: "primary",
            requestBody: { ...requestBody, id: googleId },
          });
        } catch (insertError: any) {
          if (insertError.code !== 409) throw insertError;
          await calendar.events.update({
            calendarId: "primary",
            eventId: googleId,
            requestBody,
          });
        }
      }
      await this.participants.updateOne(
        { _id: id },
        {
          googleCalendarEventId: googleId,
          syncStatus: "SYNCED",
          lastSyncedAt: event.updatedAt || new Date(),
        },
      );
    } catch (e: any) {
      if (e.response?.data?.error === "invalid_grant" || e.code === 401)
        await this.users.updateOne(
          { _id: user._id },
          { googleCalendarConnected: false },
        );
      throw e;
    }
  }
}

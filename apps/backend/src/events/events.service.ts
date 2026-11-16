import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EventDto, UpdateEventDto, EventQuery } from "../common/dto";
import { validId } from "../auth/security";
import { CalendarService } from "../google-calendar/calendar.service";
@Injectable()
export class EventsService {
  constructor(
    @InjectModel("Event") private events: Model<any>,
    @InjectModel("Wishlist") private wishlist: Model<any>,
    @InjectModel("Participant") private participants: Model<any>,
    private calendar: CalendarService,
  ) {}
  async get(id: string) {
    validId(id);
    const event = await this.events.findOne({ _id: id, deletedAt: null });
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }
  async own(id: string, user: any) {
    const event = await this.get(id);
    if (event.team !== user.team)
      throw new ForbiddenException("Only the event’s team can manage it");
    return event;
  }
  dates(data: any) {
    if (new Date(data.startDate) >= new Date(data.endDate))
      throw new BadRequestException("End time must be after start time");
    try {
      new Intl.DateTimeFormat("en", {
        timeZone: data.timezone || "Asia/Kolkata",
      });
    } catch {
      throw new BadRequestException("Unknown timezone");
    }
  }
  async create(dto: EventDto, user: any) {
    this.dates(dto);
    const event = await this.events.create({
      ...dto,
      team: user.team,
      createdBy: user._id,
    });
    const participation = await this.participants.create({
      eventId: event._id,
      userId: user._id,
    });
    await this.calendar.enqueue(participation._id);
    return this.detail(String(event._id), user);
  }
  async update(id: string, dto: UpdateEventDto, user: any) {
    const event = await this.own(id, user);
    this.dates({ ...event.toObject(), ...dto });
    await this.events.updateOne({ _id: id }, { $set: dto });
    await this.participants.updateMany(
      { eventId: id, active: true },
      { syncStatus: "PENDING" },
    );
    await this.calendar.enqueueEvent(id);
    return this.detail(id, user);
  }
  async remove(id: string, user: any) {
    validId(id);
    const event = await this.events.findById(id);
    if (!event) return { message: "Event deleted" };
    if (event.team !== user.team)
      throw new ForbiddenException("Only the event’s team can delete it");
    await this.events.updateOne({ _id: id }, { deletedAt: new Date() });
    await this.participants.updateMany(
      { eventId: id },
      { active: false, syncStatus: "PENDING" },
    );
    await this.wishlist.deleteMany({ eventId: id });
    await this.calendar.enqueueEvent(id);
    return { message: "Event deleted; calendar cleanup queued" };
  }
  async list(query: EventQuery, user: any, mode?: "own" | "joined") {
    const filter: any = { deletedAt: null };
    if (query.team) filter.team = query.team;
    if (mode === "own") filter.team = user.team;
    if (mode === "joined")
      filter._id = {
        $in: await this.participants
          .find({ userId: user._id, active: true })
          .distinct("eventId"),
      };
    if (query.search)
      filter.title = {
        $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    if (query.period === "upcoming") filter.endDate = { $gte: new Date() };
    if (query.period === "past") filter.endDate = { $lt: new Date() };
    if (query.from || query.to)
      filter.startDate = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    const page = query.page || 1;
    const limit = query.limit || 50;
    const [rows, total] = await Promise.all([
      this.events
        .find(filter)
        .sort({ startDate: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.events.countDocuments(filter),
    ]);
    return { items: await this.enrich(rows, user), total, page, limit };
  }
  async summary(user: any) {
    const [own, other, upcomingOwn, joined, taskCounts, upcoming] =
      await Promise.all([
        this.events.countDocuments({ team: user.team, deletedAt: null }),
        this.events.countDocuments({
          team: { $ne: user.team },
          deletedAt: null,
        }),
        this.events.countDocuments({
          team: user.team,
          deletedAt: null,
          endDate: { $gte: new Date() },
        }),
        this.participants.aggregate([
          { $match: { userId: user._id, active: true } },
          {
            $lookup: {
              from: "events",
              localField: "eventId",
              foreignField: "_id",
              as: "event",
            },
          },
          { $match: { "event.deletedAt": null } },
          { $count: "count" },
        ]),
        this.wishlist.aggregate([
          {
            $lookup: {
              from: "events",
              localField: "eventId",
              foreignField: "_id",
              as: "event",
            },
          },
          { $match: { "event.team": user.team, "event.deletedAt": null } },
          { $group: { _id: "$isCompleted", count: { $sum: 1 } } },
        ]),
        this.events
          .find({ deletedAt: null, endDate: { $gte: new Date() } })
          .sort({ startDate: 1 })
          .limit(4)
          .lean(),
      ]);
    const completed = taskCounts.find((t) => t._id === true)?.count || 0;
    const pending = taskCounts.find((t) => t._id === false)?.count || 0;
    return {
      own,
      other,
      upcomingOwn,
      joined: joined[0]?.count || 0,
      completed,
      pending,
      totalTasks: completed + pending,
      upcoming,
    };
  }
  async enrich(rows: any[], user: any) {
    const ids = rows.map((e) => e._id);
    const [tasks, participants] = await Promise.all([
      this.wishlist.find({ eventId: { $in: ids } }).lean(),
      this.participants.find({ eventId: { $in: ids }, active: true }).lean(),
    ]);
    return rows.map((e) => {
      const own = participants.find(
        (p) =>
          String(p.eventId) === String(e._id) &&
          String(p.userId) === String(user._id),
      );
      return {
        ...e,
        wishlist: tasks.filter((t) => String(t.eventId) === String(e._id)),
        participantCount: participants.filter(
          (p) => String(p.eventId) === String(e._id),
        ).length,
        joined: Boolean(own),
        syncStatus: own?.syncStatus,
      };
    });
  }
  async detail(id: string, user: any) {
    return (await this.enrich([(await this.get(id)).toObject()], user))[0];
  }
  async join(id: string, user: any) {
    const event = await this.get(id);
    if (event.endDate < new Date())
      throw new BadRequestException("This event has ended");
    let p;
    try {
      p = await this.participants.findOneAndUpdate(
        { eventId: id, userId: user._id },
        {
          $set: { active: true, syncStatus: "PENDING" },
          $setOnInsert: { joinedAt: new Date() },
        },
        { upsert: true, new: true },
      );
    } catch (e: any) {
      if (e.code !== 11000) throw e;
      p = await this.participants.findOne({ eventId: id, userId: user._id });
    }
    await this.calendar.enqueue(p!._id);
    return { message: "You joined the event", syncStatus: p!.syncStatus };
  }
  async leave(id: string, user: any) {
    await this.get(id);
    const p = await this.participants.findOneAndUpdate(
      { eventId: id, userId: user._id },
      { active: false, syncStatus: "PENDING" },
      { new: true },
    );
    if (p) await this.calendar.enqueue(p._id);
    return { message: "You left the event" };
  }
  async people(id: string) {
    await this.get(id);
    return this.participants
      .find({ eventId: id, active: true })
      .select("userId joinedAt syncStatus")
      .populate("userId", "fullName team profileImage");
  }
}

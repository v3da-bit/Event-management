"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  addWeeks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
  addDays,
} from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api, Page, WeddingEvent } from "@/lib/api";
import { Shell, PageHeading, Loading } from "./shell";
import { useAuth } from "./providers";
import { Button } from "./ui/button";
export function CalendarView() {
  const { user } = useAuth();
  const [current, setCurrent] = useState(new Date());
  const [view, setView] = useState("month");
  const [team, setTeam] = useState("");
  const [joined, setJoined] = useState(false);
  const start =
    view === "month"
      ? startOfWeek(startOfMonth(current), { weekStartsOn: 1 })
      : startOfWeek(current, { weekStartsOn: 1 });
  const end =
    view === "month"
      ? endOfWeek(endOfMonth(current), { weekStartsOn: 1 })
      : endOfWeek(current, { weekStartsOn: 1 });
  const params = new URLSearchParams({
    limit: "100",
    from: fromZonedTime(
      format(start, "yyyy-MM-dd") + "T00:00:00",
      "Asia/Kolkata",
    ).toISOString(),
    to: fromZonedTime(
      format(addDays(end, 1), "yyyy-MM-dd") + "T00:00:00",
      "Asia/Kolkata",
    ).toISOString(),
    ...(team ? { team } : {}),
  });
  const events = useQuery({
    queryKey: ["events", "calendar", joined, params.toString()],
    queryFn: async () => {
      const endpoint = joined ? "/events/joined" : "/events";
      const first = await api<Page<WeddingEvent>>(`${endpoint}?${params}`);
      for (let page = 2; (page - 1) * first.limit < first.total; page++) {
        const next = await api<Page<WeddingEvent>>(
          `${endpoint}?${params}&page=${page}`,
        );
        first.items.push(...next.items);
      }
      return first;
    },
    enabled: !!user,
  });
  const days = eachDayOfInterval({ start, end });
  return (
    <Shell>
      <PageHeading
        eyebrow="SAVE A LITTLE SPACE FOR JOY"
        title="A date with your favourite people."
        description="Every celebration, all in one place. Displayed in Asia/Kolkata."
        action={
          <Button asChild>
            <Link href="/events/create">
              <Plus size={16} />
              Create event
            </Link>
          </Button>
        }
      />
      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous period"
              onClick={() =>
                setCurrent(
                  view === "month"
                    ? addMonths(current, -1)
                    : addWeeks(current, -1),
                )
              }
            >
              <ChevronLeft size={18} />
            </Button>
            <h2>{format(current, "MMMM yyyy")}</h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next period"
              onClick={() =>
                setCurrent(
                  view === "month"
                    ? addMonths(current, 1)
                    : addWeeks(current, 1),
                )
              }
            >
              <ChevronRight size={18} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrent(new Date())}
            >
              Today
            </Button>
          </div>
          <div>
            <select
              aria-label="Team filter"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
            >
              <option value="">Both teams</option>
              <option value="GROOM">Team Groom</option>
              <option value="BRIDE">Team Bride</option>
            </select>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={joined}
                onChange={(e) => setJoined(e.target.checked)}
              />
              Joined only
            </label>
            <div className="tabs">
              {["month", "week"].map((v) => (
                <button
                  className={view === v ? "selected" : ""}
                  key={v}
                  onClick={() => setView(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        {events.isPending ? (
          <Loading />
        ) : events.isError ? (
          <p role="alert">{events.error.message}</p>
        ) : (
          <div className="calendar-scroll">
            <div className={`calendar-grid ${view}`}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div className="calendar-weekday" key={d}>
                  {d}
                </div>
              ))}
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`calendar-day ${!isSameMonth(day, current) ? "outside" : ""} ${isToday(day) ? "today" : ""}`}
                >
                  <span>{format(day, "d")}</span>
                  {events.data?.items
                    .filter(
                      (e) =>
                        formatInTimeZone(
                          e.startDate,
                          "Asia/Kolkata",
                          "yyyy-MM-dd",
                        ) === format(day, "yyyy-MM-dd"),
                    )
                    .map((e) => (
                      <Link
                        className={`calendar-event ${e.team.toLowerCase()}`}
                        href={`/events/${e._id}`}
                        key={e._id}
                      >
                        <small>
                          {formatInTimeZone(
                            e.startDate,
                            "Asia/Kolkata",
                            "h:mm a",
                          )}
                        </small>
                        {e.title}
                      </Link>
                    ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="calendar-legend">
          <span>
            <i className="groom" />
            Team Groom
          </span>
          <span>
            <i className="bride" />
            Team Bride
          </span>
        </div>
      </section>
    </Shell>
  );
}

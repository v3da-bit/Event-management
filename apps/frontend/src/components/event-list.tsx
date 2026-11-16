"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Plus,
  ArrowRight,
  CalendarDays,
  Heart,
  CheckCheck,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { api, Page, WeddingEvent, date } from "@/lib/api";
import { useAuth } from "./providers";
import { Shell, PageHeading, Empty, Loading } from "./shell";
import { EventCard } from "./event-card";
import { Button } from "./ui/button";
export function EventList({
  mode = "all",
  dashboard = false,
}: {
  mode?: "all" | "own" | "joined";
  dashboard?: boolean;
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("");
  const [page, setPage] = useState(1);
  const endpoint =
    mode === "own"
      ? "/events/my-team"
      : mode === "joined" || tab === "joined"
        ? "/events/joined"
        : "/events";
  const team =
    tab === "own"
      ? user?.team
      : tab === "other"
        ? user?.team === "GROOM"
          ? "BRIDE"
          : "GROOM"
        : tab === "GROOM" || tab === "BRIDE"
          ? tab
          : "";
  const params = new URLSearchParams({
    limit: "9",
    page: String(page),
    ...(search ? { search } : {}),
    ...(period ? { period } : {}),
    ...(team ? { team } : {}),
  });
  const events = useQuery({
    queryKey: ["events", endpoint, params.toString()],
    queryFn: () => api<Page<WeddingEvent>>(`${endpoint}?${params}`),
    enabled: !!user,
  });
  const stats = useQuery({
    queryKey: ["events", "summary"],
    queryFn: () =>
      api<{
        own: number;
        other: number;
        upcomingOwn: number;
        joined: number;
        completed: number;
        pending: number;
        totalTasks: number;
        upcoming: WeddingEvent[];
      }>("/events/summary"),
    enabled: !!user && dashboard,
  });
  const summary = stats.data;
  const upcoming = summary?.upcoming || [];
  const title = dashboard
    ? `A little closer to forever, ${user?.fullName.split(" ")[0] || "friend"}.`
    : mode === "own"
      ? "Your team. Your moments."
      : mode === "joined"
        ? "The moments you’re part of."
        : "Every moment, beautifully planned.";
  return (
    <Shell>
      <PageHeading
        eyebrow={dashboard ? "LET THE CELEBRATIONS BEGIN" : "THE CELEBRATION"}
        title={title}
        description={
          dashboard
            ? "Two teams, one beautiful celebration. Let’s make every detail count."
            : "Bring the people you love together, one celebration at a time."
        }
        action={
          <Button asChild>
            <Link href="/events/create">
              <Plus size={17} />
              Create event
            </Link>
          </Button>
        }
      />
      {dashboard && (
        <>
          <section className="welcome-banner">
            <div className="banner-copy">
              <span className="banner-kicker">
                <span /> YOUR HAPPILY EVER AFTER, ORGANIZED
              </span>
              <h2>
                For all the moments
                <br />
                before <i>“I do.”</i>
              </h2>
              <p>
                From the first dance to the final detail,
                <br />
                plan a celebration that feels like you.
              </p>
              <Link href="/calendar">
                Explore your celebration <ArrowRight size={16} />
              </Link>
            </div>
            <div className="banner-art">
              <div className="arch arch-one" />
              <div className="arch arch-two" />
              <span className="botanical botanical-one">❧</span>
              <span className="botanical botanical-two">❧</span>
              <div className="banner-seal">
                <Heart size={20} strokeWidth={1} />
                <span>
                  TWO FAMILIES
                  <br />
                  ONE LOVE
                </span>
                <small>est. forever</small>
              </div>
              <span className="banner-star">✧</span>
            </div>
          </section>
          <section className="stats-grid">
            {[
              {
                label: "My team events",
                value: summary?.own || 0,
                icon: CalendarDays,
                detail: `${summary?.upcomingOwn || 0} upcoming celebrations`,
                color: "sage",
              },
              {
                label: "Other team events",
                value: summary?.other || 0,
                icon: Heart,
                detail: "More reasons to celebrate",
                color: "rose",
              },
              {
                label: "Joined events",
                value: summary?.joined || 0,
                icon: Sparkles,
                detail: "Your seat is saved",
                color: "gold",
              },
              {
                label: "Wishlist completed",
                value: `${summary?.completed || 0}/${summary?.totalTasks || 0}`,
                icon: CheckCheck,
                detail: `${summary?.pending || 0} little details to go`,
                color: "lavender",
              },
            ].map(({ label, value, icon: Icon, detail, color }) => (
              <div className="stat-card" key={label}>
                <div>
                  <span>{label}</span>
                  <span className={`stat-icon ${color}`}>
                    <Icon size={18} />
                  </span>
                </div>
                <b>{stats.isPending ? "—" : value}</b>
                <small>{detail}</small>
              </div>
            ))}
          </section>
        </>
      )}
      <div className={dashboard ? "dashboard-columns" : ""}>
        <section className="events-section">
          <div className="section-heading">
            <div>
              <h2>
                {dashboard
                  ? "Your celebrations"
                  : mode === "joined"
                    ? "Your guest list"
                    : "The event collection"}
              </h2>
              <p>Big days. Little details. Beautiful memories.</p>
            </div>
            {dashboard && (
              <Link href="/events" className="text-link">
                View all <ArrowRight size={15} />
              </Link>
            )}
          </div>
          <div className="event-controls">
            <div className="tabs">
              {(dashboard
                ? [
                    { key: "all", label: "All events" },
                    { key: "own", label: "My team" },
                    {
                      key: "other",
                      label: `Team ${user?.team === "GROOM" ? "Bride" : "Groom"}`,
                    },
                    { key: "joined", label: "Joined" },
                  ]
                : mode === "all"
                  ? [
                      { key: "all", label: "All events" },
                      { key: "GROOM", label: "Team Groom" },
                      { key: "BRIDE", label: "Team Bride" },
                    ]
                  : [
                      {
                        key: "all",
                        label:
                          mode === "own" ? "My team events" : "Joined events",
                      },
                    ]
              ).map((t) => (
                <button
                  key={t.key}
                  className={tab === t.key ? "selected" : ""}
                  onClick={() => {
                    setTab(t.key);
                    setPage(1);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="search-row">
              <label className="search-input">
                <Search size={16} />
                <input
                  placeholder="Find a moment…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <select
                aria-label="Filter event dates"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All dates</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
            </div>
          </div>
          {events.isPending ? (
            <Loading />
          ) : events.isError ? (
            <div className="error-state">
              {events.error.message}
              <Button variant="outline" onClick={() => events.refetch()}>
                Try again
              </Button>
            </div>
          ) : !events.data?.items.length ? (
            <Empty
              title={search ? "No moments found" : undefined}
              description={
                search
                  ? "Try another search or change your filters."
                  : undefined
              }
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`events-grid ${dashboard ? "compact" : ""}`}
            >
              {events.data.items.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </motion.div>
          )}
          {events.data && events.data.total > 9 && (
            <div className="pagination">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {Math.ceil(events.data.total / 9)}
              </span>
              <Button
                variant="outline"
                disabled={page * 9 >= events.data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </section>
        {dashboard && (
          <aside className="dashboard-aside">
            <div className="timeline panel">
              <div className="section-heading">
                <h3>Coming up</h3>
                <CalendarDays size={17} />
              </div>
              <p className="muted text-sm mb-5">
                A few dates to look forward to
              </p>
              {upcoming.slice(0, 4).map((e) => (
                <Link
                  className="timeline-item"
                  key={e._id}
                  href={`/events/${e._id}`}
                >
                  <div className={`timeline-dot ${e.team.toLowerCase()}`} />
                  <span className="timeline-date">
                    {date(e.startDate, e.timezone)}
                  </span>
                  <strong>{e.title}</strong>
                  <small>{e.location || "Details coming soon"}</small>
                </Link>
              ))}
              {!upcoming.length && (
                <p className="muted">
                  Your next chapter is ready to be planned.
                </p>
              )}
              <Link href="/calendar" className="text-link">
                Open calendar <ArrowRight size={14} />
              </Link>
            </div>
            <div className="calendar-promo panel">
              <span className="google-mark">G</span>
              <h3>Keep the joy in sync.</h3>
              <p>
                {user?.googleCalendarConnected
                  ? "Your joined events stay connected to your Google Calendar."
                  : "Connect Google Calendar and keep every celebration close."}
              </p>
              <Button asChild variant="outline">
                <Link href="/settings">
                  {user?.googleCalendarConnected
                    ? "Manage connection"
                    : "Connect calendar"}
                  <ArrowUpRightIcon />
                </Link>
              </Button>
            </div>
            <p className="aside-quote">
              “The best thing to hold onto
              <br />
              in life is each other.”<span>— AUDREY HEPBURN</span>
            </p>
          </aside>
        )}
      </div>
    </Shell>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={14} style={{ transform: "rotate(-45deg)" }} />;
}

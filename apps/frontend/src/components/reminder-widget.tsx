"use client";
import { useQuery } from "@tanstack/react-query";
import { Bell, MapPin, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { api, date } from "@/lib/api";
import { useAuth } from "./providers";
import type { EventReminder } from "@everafter/shared-types";

function timeUntil(startDate: string) {
  const diff = new Date(startDate).getTime() - Date.now();
  if (diff <= 0) return "Starting now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `in ${days}d`;
}

function useReminders(poll = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["reminders"],
    queryFn: () =>
      api<{ total: number; items: EventReminder[] }>("/events/reminders"),
    enabled: !!user,
    refetchInterval: poll ? 60000 : false,
  });
}

const shownReminders = new Set<string>();

export function ReminderNotifications() {
  const { user } = useAuth();
  const { data } = useReminders(true);
  const router = useRouter();
  useEffect(() => {
    if (!user || !data) return;
    const upcoming = data.items.filter((event) => {
      if (Date.parse(event.startDate) <= Date.now()) return false;
      const key = [
        user._id,
        event._id,
        event.startDate,
        event.reminderMinutes,
      ].join(":");
      if (shownReminders.has(key)) return false;
      shownReminders.add(key);
      return true;
    });
    if (!upcoming.length) return;
    const [event] = upcoming;
    const tasks = event.pendingItems;
    const more = tasks.length > 3 ? ` and ${tasks.length - 3} more` : "";
    toast(
      upcoming.length > 1
        ? `${upcoming.length} upcoming event reminders`
        : event.title,
      {
        description:
          upcoming.length > 1
            ? "See upcoming events and their pending wishlists."
            : tasks.length
              ? `Pending: ${tasks
                  .slice(0, 3)
                  .map((item) => item.title)
                  .join(", ")}${more}`
              : "Your event is coming up.",
        action: {
          label: upcoming.length > 1 ? "Dashboard" : "View event",
          onClick: () =>
            router.push(
              upcoming.length > 1 ? "/dashboard" : `/events/${event._id}`,
            ),
        },
      },
    );
  }, [data, router, user]);
  return null;
}

export function ReminderWidget() {
  const reminders = useReminders();

  if (!reminders.data?.items.length) return null;

  return (
    <section className="panel reminder-widget">
      <div className="section-heading">
        <h3>
          <Bell size={17} /> Upcoming reminders
        </h3>
        {reminders.data.total > reminders.data.items.length && (
          <span className="muted text-sm">
            +{reminders.data.total - reminders.data.items.length} more
          </span>
        )}
      </div>
      <div className="reminder-list">
        {reminders.data.items.map((r) => (
          <Link key={r._id} href={`/events/${r._id}`} className="reminder-item">
            <div className="reminder-header">
              <strong>{r.title}</strong>
              <span className="reminder-time">
                <Clock size={13} />
                {timeUntil(r.startDate)} ·{" "}
                {date(r.startDate, r.timezone, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {r.pendingItems.length > 0 && (
              <div className="reminder-tasks">
                <span className="muted text-sm">
                  {r.pendingItems.length} pending{" "}
                  {r.pendingItems.length === 1 ? "task" : "tasks"}:
                </span>
                <ul>
                  {r.pendingItems.slice(0, 3).map((t) => (
                    <li key={t._id}>
                      <span>{t.title}</span>
                      {t.location && (
                        <span className="task-location">
                          <MapPin size={11} />
                          {t.location}
                        </span>
                      )}
                    </li>
                  ))}
                  {r.pendingItems.length > 3 && (
                    <li className="muted text-sm">
                      +{r.pendingItems.length - 3} more tasks
                    </li>
                  )}
                </ul>
              </div>
            )}
            <span className="text-link text-sm">
              View event <ArrowRight size={12} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

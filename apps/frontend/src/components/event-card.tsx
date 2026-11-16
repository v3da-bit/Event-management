"use client";
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  ArrowUpRight,
  Check,
  UsersRound,
  Pencil,
  Trash2,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, json, date, progress, WeddingEvent } from "@/lib/api";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { useAuth } from "./providers";
import { useState } from "react";
export function TeamBadge({ team }: { team: string }) {
  return (
    <span className={`team-badge ${team.toLowerCase()}`}>
      <span />
      {team === "GROOM" ? "Team Groom" : "Team Bride"}
    </span>
  );
}
export function JoinButton({
  event,
  small,
}: {
  event: WeddingEvent;
  small?: boolean;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api(
        `/events/${event._id}/${event.joined ? "leave" : "join"}`,
        json(event.joined ? "DELETE" : "POST"),
      ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["events"] });
      client.invalidateQueries({ queryKey: ["event", event._id] });
      client.invalidateQueries({ queryKey: ["participants", event._id] });
      toast.success(
        event.joined ? "You left the event" : "You’re on the guest list!",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button
      variant={event.joined ? "outline" : "default"}
      size={small ? "sm" : "default"}
      disabled={
        mutation.isPending ||
        (!event.joined && new Date(event.endDate) < new Date())
      }
      onClick={() => mutation.mutate()}
    >
      {event.joined && <Check size={14} />}{" "}
      {mutation.isPending
        ? "Saving…"
        : event.joined
          ? "Leave event"
          : "Join event"}
    </Button>
  );
}
export function EventCard({ event }: { event: WeddingEvent }) {
  const done = event.wishlist.filter((t) => t.isCompleted).length;
  return (
    <article className="event-card">
      <Link
        href={`/events/${event._id}`}
        className={`event-cover cover-${event.team.toLowerCase()}`}
        style={
          event.coverImage
            ? { backgroundImage: `url("${event.coverImage}")` }
            : {}
        }
      >
        <TeamBadge team={event.team} />
        {event.joined && (
          <span className="joined-pill">
            <Check size={12} />
            Joined
          </span>
        )}
        {!event.coverImage && <div className="cover-ornament">❧</div>}
        <span className="cover-date">
          <b>
            {date(event.startDate, event.timezone, {
              day: "2-digit",
              month: undefined,
            })}
          </b>
          {date(event.startDate, event.timezone, {
            day: undefined,
            month: "short",
          }).toUpperCase()}
        </span>
      </Link>
      <div className="event-card-body">
        <div className="event-type">
          A MOMENT TO REMEMBER <span>✧</span>
        </div>
        <Link href={`/events/${event._id}`}>
          <h3>{event.title}</h3>
        </Link>
        <p className="event-description">{event.description}</p>
        <div className="event-meta">
          <CalendarDays size={14} />
          {date(event.startDate, event.timezone)} ·{" "}
          {date(event.startDate, event.timezone, {
            day: undefined,
            month: undefined,
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
        <div className="event-meta">
          <MapPin size={14} />
          {event.location || "Location to be announced"}
        </div>
        <div className="card-progress">
          <div>
            <span>Wishlist progress</span>
            <b>
              {done}
              <span> / {event.wishlist.length}</span>
            </b>
          </div>
          <div className="progress-track">
            <div style={{ width: `${progress(event)}%` }} />
          </div>
        </div>
        <div className="card-bottom">
          <span className="participant-count">
            <UsersRound size={15} />
            {event.participantCount} attending
          </span>
          <Link href={`/events/${event._id}`}>
            View details <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="card-actions">
          <JoinButton event={event} small />
          <CardManagement event={event} />
        </div>
      </div>
    </article>
  );
}

function CardManagement({ event }: { event: WeddingEvent }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api(`/events/${event._id}`, json("DELETE")),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["events"] });
      setOpen(false);
      toast.success("Event deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (user?.team !== event.team) return null;
  return (
    <div className="card-management">
      <Link
        aria-label={`Edit ${event.title}`}
        href={`/events/${event._id}/edit`}
      >
        <Pencil size={14} />
      </Link>
      <button
        aria-label={`Delete ${event.title}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={14} />
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Remove this celebration?"
      >
        <p className="muted mb-6">
          This removes “{event.title}” and its wishlist. Calendar cleanup will
          run in the background.
        </p>
        <Button
          variant="destructive"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
        >
          Delete event
        </Button>
      </Dialog>
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  CalendarDays,
  MapPin,
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  UsersRound,
  LockKeyhole,
  Check,
  Clock,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  json,
  WeddingEvent,
  WishlistItem,
  Participant,
  date,
  progress,
} from "@/lib/api";
import { Shell, Loading } from "./shell";
import { useAuth } from "./providers";
import { TeamBadge, JoinButton } from "./event-card";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Field } from "./auth-form";
import { ImageUpload } from "./image-upload";
import { LocationPicker, LocationLink } from "./location-picker";
import { LocationPin } from "@everafter/shared-types";

function reminderLabel(m: number): string {
  if (m === 0) return "No reminder";
  if (m === 15) return "15 minutes before";
  if (m === 60) return "1 hour before";
  if (m === 1440) return "1 day before";
  if (m === 10080) return "1 week before";
  return `${m} minutes before`;
}
export function EventDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const router = useRouter();
  const event = useQuery({
    queryKey: ["event", id],
    queryFn: () => api<WeddingEvent>(`/events/${id}`),
    enabled: !!user,
  });
  const people = useQuery({
    queryKey: ["participants", id],
    queryFn: () => api<Participant[]>(`/events/${id}/participants`),
    enabled: !!event.data,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [editing, setEditing] = useState<WishlistItem>();
  const [item, setItem] = useState({
    title: "",
    description: "",
    image: "",
    location: "",
    locationPin: null as LocationPin | null,
  });
  const [deleteItem, setDeleteItem] = useState<WishlistItem>();
  const refresh = () => {
    client.invalidateQueries({ queryKey: ["event", id] });
    client.invalidateQueries({ queryKey: ["events"] });
    client.invalidateQueries({ queryKey: ["reminders"] });
  };
  const remove = useMutation({
    mutationFn: () => api(`/events/${id}`, json("DELETE")),
    onSuccess: () => {
      refresh();
      toast.success("Event deleted");
      router.push("/events");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveItem = useMutation({
    mutationFn: () =>
      api(
        `/events/${id}/wishlist${editing ? `/${editing._id}` : ""}`,
        json(editing ? "PATCH" : "POST", {
          title: item.title,
          description: item.description,
          image: item.image || null,
          location: item.location.trim(),
          locationPin: item.locationPin || null,
        }),
      ),
    onSuccess: () => {
      refresh();
      setItemOpen(false);
      toast.success("Wishlist updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeItem = useMutation({
    mutationFn: () =>
      api(`/events/${id}/wishlist/${deleteItem?._id}`, json("DELETE")),
    onSuccess: () => {
      refresh();
      setDeleteItem(undefined);
      toast.success("Item removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (t: WishlistItem) =>
      api(
        `/events/${id}/wishlist/${t._id}/toggle`,
        json("PATCH", { isCompleted: !t.isCompleted }),
      ),
    onMutate: async (t) => {
      await client.cancelQueries({ queryKey: ["event", id] });
      const previous = client.getQueryData<WeddingEvent>(["event", id]);
      if (previous)
        client.setQueryData(["event", id], {
          ...previous,
          wishlist: previous.wishlist.map((i) =>
            i._id === t._id ? { ...i, isCompleted: !i.isCompleted } : i,
          ),
        });
      return { previous };
    },
    onError: (e: Error, _, ctx) => {
      if (ctx?.previous) client.setQueryData(["event", id], ctx.previous);
      toast.error(e.message);
    },
    onSettled: refresh,
  });
  const e = event.data;
  const own = e?.team === user?.team;
  return (
    <Shell>
      {event.isPending ? (
        <Loading />
      ) : event.isError || !e ? (
        <div className="error-state">
          {event.error?.message || "Event not found"}
          <Link href="/events">Back to events</Link>
        </div>
      ) : (
        <>
          <Link className="back-link" href="/events">
            <ArrowLeft size={15} />
            Back to celebrations
          </Link>
          <div
            className={`detail-cover cover-${e.team.toLowerCase()}`}
            style={
              e.coverImage ? { backgroundImage: `url("${e.coverImage}")` } : {}
            }
          >
            {!e.coverImage && <span className="detail-ornament">❧</span>}
            <TeamBadge team={e.team} />
          </div>
          <div className="detail-header">
            <div>
              <span className="eyebrow">A MOMENT TO REMEMBER</span>
              <h1>{e.title}</h1>
              <div className="detail-meta">
                <span>
                  <CalendarDays size={16} />
                  {date(e.startDate, e.timezone, { year: "numeric" })}
                </span>
                <span>
                  <Clock size={16} />
                  {date(e.startDate, e.timezone, {
                    day: undefined,
                    month: undefined,
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  –{" "}
                  {date(e.endDate, e.timezone, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span>
                  {e.locationPin || e.location ? (
                    <LocationLink location={e.location} pin={e.locationPin} />
                  ) : (
                    <>
                      <MapPin size={16} /> Location to be announced
                    </>
                  )}
                </span>
              </div>
              <small className="muted">All times in {e.timezone}</small>
            </div>
            <div className="detail-actions">
              <JoinButton event={e} />
              {own && (
                <>
                  <Button asChild variant="outline" size="icon">
                    <Link href={`/events/${id}/edit`} aria-label="Edit event">
                      <Pencil size={17} />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete event"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 size={17} />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="detail-columns">
            <div>
              <section className="panel">
                <h2>About this celebration</h2>
                <p className="event-story">{e.description}</p>
              </section>
              <section className="panel wishlist-panel">
                <div className="section-heading">
                  <div>
                    <h2>Love is in the little details.</h2>
                    <p>The wishlist that brings this moment to life.</p>
                  </div>
                  {own && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(undefined);
                        setItem({
                          title: "",
                          description: "",
                          image: "",
                          location: "",
                          locationPin: null,
                        });
                        setItemOpen(true);
                      }}
                    >
                      <Plus size={15} />
                      Add item
                    </Button>
                  )}
                </div>
                <div className="wishlist-summary">
                  <span>
                    {e.wishlist.filter((t) => t.isCompleted).length} of{" "}
                    {e.wishlist.length} details taken care of
                  </span>
                  <b>{progress(e)}%</b>
                  <div className="progress-track">
                    <div style={{ width: `${progress(e)}%` }} />
                  </div>
                </div>
                {!own && (
                  <p className="permission-note">
                    <LockKeyhole size={14} />A little peek at the other team’s
                    plans. Their team manages this wishlist.
                  </p>
                )}
                {["Pending", "Completed"].map((group) => {
                  const tasks = e.wishlist.filter(
                    (t) => t.isCompleted === (group === "Completed"),
                  );
                  return (
                    !!tasks.length && (
                      <div key={group}>
                        <h4 className="task-group">
                          {group} <span>{tasks.length}</span>
                        </h4>
                        {tasks.map((t) => (
                          <div
                            className={`wishlist-item ${t.isCompleted ? "completed" : ""}`}
                            key={t._id}
                          >
                            <input
                              aria-label={`Mark ${t.title} ${t.isCompleted ? "pending" : "completed"}`}
                              type="checkbox"
                              checked={t.isCompleted}
                              disabled={!own || toggle.isPending}
                              onChange={() => toggle.mutate(t)}
                            />
                            {t.image && <img src={t.image} alt={t.title} />}
                            <div>
                              <strong>{t.title}</strong>
                              {t.description && <p>{t.description}</p>}
                              {(t.location || t.locationPin) && (
                                <LocationLink
                                  location={t.location}
                                  pin={t.locationPin}
                                />
                              )}
                              {t.completedAt && (
                                <small>
                                  Completed {date(t.completedAt, e.timezone)}
                                </small>
                              )}
                            </div>
                            {own && (
                              <div className="item-actions">
                                <button
                                  aria-label={`Edit ${t.title}`}
                                  onClick={() => {
                                    setEditing(t);
                                    setItem({
                                      title: t.title,
                                      description: t.description || "",
                                      image: t.image || "",
                                      location: t.location || "",
                                      locationPin: t.locationPin || null,
                                    });
                                    setItemOpen(true);
                                  }}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  aria-label={`Delete ${t.title}`}
                                  onClick={() => setDeleteItem(t)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  );
                })}
                {!e.wishlist.length && (
                  <p className="empty-wishlist">
                    A fresh page for all the little things.{" "}
                    {own
                      ? "Add your first wishlist item."
                      : "Check back for this team’s plans."}
                  </p>
                )}
              </section>
            </div>
            <aside>
              <section className="panel">
                <h3>
                  <UsersRound size={18} />
                  The people who make it special
                </h3>
                <p className="muted text-sm mb-5">
                  {e.participantCount} people joining the celebration
                </p>
                {people.data?.map((p) => (
                  <div className="person" key={p._id}>
                    <span
                      className={`avatar small ${p.userId?.team?.toLowerCase()}`}
                    >
                      {p.userId?.fullName?.[0] || "?"}
                    </span>
                    <div>
                      {p.userId?.fullName || "Guest"}
                      <small>
                        Team {p.userId?.team === "GROOM" ? "Groom" : "Bride"}
                      </small>
                    </div>
                  </div>
                ))}
              </section>
              {e.joined && (
                <section className="panel sync-panel">
                  <Check size={20} />
                  <h3>Your seat is saved.</h3>
                  <p>
                    {e.syncStatus === "SYNCED"
                      ? "This moment is synced to your Google Calendar."
                      : e.syncStatus === "FAILED"
                        ? "Calendar sync needs attention. Reconnect or retry in settings."
                        : "Calendar synchronization is pending. Connect your calendar to keep this moment close."}
                  </p>
                  <Link className="text-link" href="/settings">
                    Calendar settings →
                  </Link>
                </section>
              )}
              {e.reminderMinutes !== undefined && e.reminderMinutes !== 0 && (
                <section className="panel reminder-info-panel">
                  <Bell size={18} />
                  <h3>Reminder set</h3>
                  <p>{reminderLabel(e.reminderMinutes)}</p>
                </section>
              )}
            </aside>
          </div>
        </>
      )}
      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove this celebration?"
      >
        <p className="muted mb-6">
          This deletes its wishlist and queues removal of app-created calendar
          entries for everyone attending.
        </p>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>
            Keep event
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete event
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={itemOpen}
        onOpenChange={setItemOpen}
        title={editing ? "Refine a little detail" : "Add a little detail"}
      >
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            saveItem.mutate();
          }}
        >
          <Field label="Item title">
            <input
              required
              maxLength={200}
              value={item.title}
              onChange={(e) => setItem({ ...item, title: e.target.value })}
            />
          </Field>
          <Field label="Description (optional)">
            <textarea
              maxLength={2000}
              rows={3}
              value={item.description}
              onChange={(e) =>
                setItem({ ...item, description: e.target.value })
              }
            />
          </Field>
          <Field label="Image (optional)">
            <ImageUpload
              value={item.image}
              onChange={(image) => setItem({ ...item, image })}
            />
          </Field>
          <LocationPicker
            location={item.location}
            pin={item.locationPin}
            onChange={(location, locationPin) =>
              setItem((current) => ({ ...current, location, locationPin }))
            }
          />
          <Button
            type="submit"
            disabled={saveItem.isPending || !item.title.trim()}
          >
            Save detail
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={!!deleteItem}
        onOpenChange={() => setDeleteItem(undefined)}
        title="Remove this wishlist item?"
      >
        <p className="muted mb-6">
          “{deleteItem?.title}” will be removed from the wishlist.
        </p>
        <Button
          variant="destructive"
          disabled={removeItem.isPending}
          onClick={() => removeItem.mutate()}
        >
          Remove item
        </Button>
      </Dialog>
    </Shell>
  );
}

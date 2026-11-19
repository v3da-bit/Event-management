"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { toast } from "sonner";
import { Plus, X, ArrowLeft, Heart } from "lucide-react";
import { api, json, WeddingEvent } from "@/lib/api";
import { Shell, PageHeading, Loading } from "./shell";
import { useAuth } from "./providers";
import { Field } from "./auth-form";
import { Button } from "./ui/button";
import { ImageUpload } from "./image-upload";
const schema = z
  .object({
    title: z.string().trim().min(1, "Give your moment a name").max(150),
    description: z.string().trim().min(1, "Add a description").max(10000),
    startDate: z.string().min(1, "Choose a start time"),
    endDate: z.string().min(1, "Choose an end time"),
    timezone: z.string().min(1),
    location: z.string(),
    coverImage: z.string(),
  })
  .superRefine((values, ctx) => {
    const start = fromZonedTime(values.startDate, values.timezone).getTime();
    const end = fromZonedTime(values.endDate, values.timezone).getTime();
    if (values.startDate && !Number.isFinite(start))
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Choose a valid start date and time",
      });
    if (values.endDate && !Number.isFinite(end))
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Choose a valid end date and time",
      });
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message:
          "End date and time must be after the start. A later time on the same day is allowed.",
      });
  });
type Values = z.infer<typeof schema>;
export function EventForm({ id }: { id?: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const { user } = useAuth();
  const [items, setItems] = useState<string[]>([]);
  const [item, setItem] = useState("");
  const [savedId, setSavedId] = useState<string>();
  const [remaining, setRemaining] = useState<string[]>([]);
  const event = useQuery({
    queryKey: ["event", id],
    queryFn: () => api<WeddingEvent>(`/events/${id}`),
    enabled: !!id && !!user,
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      timezone: "Asia/Kolkata",
      location: "",
      coverImage: "",
    },
  });
  useEffect(() => {
    if (event.data) {
      const e = event.data;
      form.reset({
        title: e.title,
        description: e.description,
        timezone: e.timezone,
        startDate: formatInTimeZone(
          e.startDate,
          e.timezone,
          "yyyy-MM-dd'T'HH:mm",
        ),
        endDate: formatInTimeZone(e.endDate, e.timezone, "yyyy-MM-dd'T'HH:mm"),
        location: e.location || "",
        coverImage: e.coverImage || "",
      });
    }
  }, [event.data, form]);
  async function save(values: Values) {
    try {
      const start = fromZonedTime(values.startDate, values.timezone);
      const end = fromZonedTime(values.endDate, values.timezone);
      const dto = {
        ...values,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        coverImage: values.coverImage || null,
      };
      const e = await api<WeddingEvent>(
        id ? `/events/${id}` : "/events",
        json(id ? "PATCH" : "POST", dto),
      );
      setSavedId(e._id);
      const pending = [...items];
      setRemaining(pending);
      for (const title of items) {
        await api(`/events/${e._id}/wishlist`, json("POST", { title }));
        pending.shift();
        setRemaining([...pending]);
      }
      client.invalidateQueries({ queryKey: ["events"] });
      client.invalidateQueries({ queryKey: ["event", e._id] });
      toast.success(id ? "Event updated" : "A new moment to look forward to");
      router.push(`/events/${e._id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <Shell>
      <Link className="back-link" href={id ? `/events/${id}` : "/events"}>
        <ArrowLeft size={15} />
        Back to {id ? "event" : "events"}
      </Link>
      <PageHeading
        eyebrow="MAKE IT A MOMENT"
        title={
          id ? "A little fine-tuning." : "Every celebration starts with a plan."
        }
        description="The big picture, the little details — make this moment yours."
      />
      {id && event.isPending ? (
        <Loading />
      ) : event.isError ? (
        <p role="alert">{event.error.message}</p>
      ) : id && event.data?.team !== user?.team ? (
        <p role="alert">Only this event’s team can edit it.</p>
      ) : savedId && remaining.length ? (
        <div className="panel">
          <h2>Your event is saved.</h2>
          <p>
            Some wishlist items could not be added. You can finish them on the
            event page.
          </p>
          <Button asChild>
            <Link href={`/events/${savedId}`}>Open saved event</Link>
          </Button>
        </div>
      ) : (
        <form className="event-form-layout" onSubmit={form.handleSubmit(save)}>
          <div className="panel form-panel">
            <h2>The details that matter</h2>
            <Field
              label="Event title"
              error={form.formState.errors.title?.message}
            >
              <input
                placeholder="e.g. A little mehendi, a lot of love"
                {...form.register("title")}
              />
            </Field>
            <Field
              label="Tell the story"
              error={form.formState.errors.description?.message}
            >
              <textarea
                rows={5}
                placeholder="What makes this celebration special?"
                {...form.register("description")}
              />
            </Field>
            <div className="form-row">
              <Field
                label="Starts at"
                error={form.formState.errors.startDate?.message}
              >
                <input
                  type="datetime-local"
                  {...form.register("startDate", { deps: ["endDate"] })}
                />
              </Field>
              <Field
                label="Ends at"
                error={form.formState.errors.endDate?.message}
              >
                <input type="datetime-local" {...form.register("endDate")} />
              </Field>
            </div>
            <p className="muted text-sm">
              Start and end can be on the same date. Choose an end time later
              than the start time, using the timezone below.
            </p>
            <Field label="Timezone">
              <select
                {...form.register("timezone", {
                  deps: ["startDate", "endDate"],
                })}
              >
                {Intl.supportedValuesOf("timeZone")
                  .concat("Asia/Kolkata")
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .sort()
                  .map((t) => (
                    <option key={t}>{t}</option>
                  ))}
              </select>
            </Field>
            <Field label="Location (optional)">
              <input
                placeholder="A place to make memories"
                {...form.register("location")}
              />
            </Field>
            <Field label="Cover image (optional)">
              <ImageUpload
                value={form.watch("coverImage")}
                onChange={(url) => form.setValue("coverImage", url)}
              />
            </Field>
            {!id && (
              <>
                <h3 className="mt-6">The little details</h3>
                <p className="muted text-sm">
                  Add a few wishlist tasks. You can always add more later.
                </p>
                <div className="inline-form">
                  <input
                    aria-label="Wishlist item"
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                    placeholder="e.g. Confirm the photographer"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!item.trim()}
                    onClick={() => {
                      setItems([...items, item.trim()]);
                      setItem("");
                    }}
                  >
                    <Plus size={16} />
                    Add
                  </Button>
                </div>
                {items.map((t, i) => (
                  <div className="draft-item" key={i}>
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove ${t}`}
                      onClick={() => setItems(items.filter((_, n) => n !== i))}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </>
            )}
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button disabled={form.formState.isSubmitting} type="submit">
                {form.formState.isSubmitting
                  ? "Saving your moment…"
                  : id
                    ? "Save changes"
                    : "Create celebration"}
              </Button>
            </div>
          </div>
          <aside>
            <div className="form-note">
              <Heart size={25} strokeWidth={1} />
              <h3>Planned by your people.</h3>
              <p>
                This event belongs to Team{" "}
                {user?.team === "GROOM" ? "Groom" : "Bride"}. Your teammates can
                help manage it, and both families can join the celebration.
              </p>
              <p>
                You’ll automatically join when you create it. Connect Google
                Calendar in settings to keep your plans in sync.
              </p>
            </div>
          </aside>
        </form>
      )}
    </Shell>
  );
}

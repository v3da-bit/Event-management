"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ShieldCheck,
  RefreshCw,
  Link2,
  Heart,
} from "lucide-react";
import { api, json, API_URL, User } from "@/lib/api";
import { Shell, PageHeading } from "./shell";
import { useAuth } from "./providers";
import { Field } from "./auth-form";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { ImageUpload } from "./image-upload";
export function Account({ settings = false }: { settings?: boolean }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string>();
  const [image, setImage] = useState<string>();
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [disconnect, setDisconnect] = useState(false);
  useEffect(() => {
    if (!settings) return;
    const url = new URL(window.location.href);
    const result = url.searchParams.get("calendar");
    if (!result) return;
    if (result === "connected") {
      toast.success(
        "Google Calendar connected. Your joined events are queued for sync.",
      );
      client.invalidateQueries({ queryKey: ["me"] });
      client.invalidateQueries({ queryKey: ["calendar-status"] });
    } else
      toast.error(
        "Google Calendar connection failed. Check your OAuth configuration and try again.",
      );
    url.searchParams.delete("calendar");
    window.history.replaceState(null, "", url);
  }, [settings, client]);
  const status = useQuery({
    queryKey: ["calendar-status"],
    queryFn: () =>
      api<{
        connected: boolean;
        configured: boolean;
        counts: { _id: string; count: number }[];
      }>("/google-calendar/status"),
    enabled: !!user,
  });
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      client.invalidateQueries({ queryKey: ["me"] });
      client.invalidateQueries({ queryKey: ["calendar-status"] });
      toast.success(message);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <PageHeading
        eyebrow="YOUR LITTLE CORNER"
        title={
          settings ? "Make yourself at home." : "The person behind the plans."
        }
        description={
          settings
            ? "Keep your account and your calendar beautifully connected."
            : "A few details that make this space yours."
        }
      />
      <div className="account-grid">
        <section className="panel form-panel">
          <h2>{settings ? "Google Calendar" : "Your profile"}</h2>
          {!settings ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                action(
                  () =>
                    api<User>(
                      "/users/me",
                      json("PATCH", {
                        fullName: name ?? user?.fullName,
                        ...(image !== undefined
                          ? { profileImage: image || null }
                          : {}),
                      }),
                    ),
                  "Profile updated",
                );
              }}
            >
              <Field label="Full name">
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={name ?? user?.fullName ?? ""}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Email address">
                <input value={user?.email || ""} disabled />
              </Field>
              <Field label="Your team">
                <input
                  disabled
                  value={`Team ${user?.team === "GROOM" ? "Groom" : "Bride"}`}
                />
                <small className="muted">
                  Your team was chosen at registration and is permanent.
                </small>
              </Field>
              <Field label="Profile image">
                <ImageUpload
                  value={image ?? user?.profileImage}
                  onChange={setImage}
                />
              </Field>
              <Button type="submit" disabled={busy}>
                Save your details
              </Button>
            </form>
          ) : (
            <>
              <div className="connection-status">
                <div className="google-mark">G</div>
                <div>
                  <h3>
                    {status.data?.connected
                      ? "Your moments are connected."
                      : "Keep the celebration close."}
                  </h3>
                  <p>
                    {status.data?.connected
                      ? "Joined events synchronize with your personal Google Calendar."
                      : "Connect your Google account to add joined events to your calendar."}
                  </p>
                </div>
                <span
                  className={`status-pill ${status.data?.connected ? "connected" : ""}`}
                >
                  {status.data?.connected ? "Connected" : "Not connected"}
                </span>
              </div>
              {status.isError && (
                <p className="field-error">{status.error.message}</p>
              )}
              {status.data && !status.data.configured && (
                <p className="configuration-note">
                  Google OAuth is not configured yet. Add your Google client
                  credentials and token encryption key to the backend
                  environment, then restart the API.
                </p>
              )}
              <p className="muted text-sm mb-6">
                Ever After creates and manages entries for the events you join.
                Changes flow from this app to Google. Disconnecting queues
                removal of those entries.
              </p>
              <div className="sync-counts">
                {status.data?.counts.map((c) => (
                  <span key={c._id}>
                    {c.count} {c._id.toLowerCase()}
                  </span>
                ))}
              </div>
              <div className="connection-actions">
                {status.data?.connected ? (
                  <>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        action(
                          () => api("/google-calendar/sync", json("POST")),
                          "Synchronization queued",
                        )
                      }
                    >
                      <RefreshCw size={16} />
                      Sync joined events
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDisconnect(true)}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={!status.data?.configured}
                    onClick={() => {
                      window.location.href = `${API_URL}/google-calendar/connect`;
                    }}
                  >
                    <Link2 size={16} />
                    Connect Google Calendar
                  </Button>
                )}
              </div>
              {!status.data?.connected && status.data?.configured && (
                <Button
                  className="mt-4"
                  variant="ghost"
                  onClick={() => {
                    window.location.href = `${API_URL}/google-calendar/connect`;
                  }}
                >
                  Reconnect after a sync error →
                </Button>
              )}
            </>
          )}
        </section>
        <section className="panel form-panel">
          <ShieldCheck size={22} className="mb-4" />
          <h2>A little peace of mind.</h2>
          <p className="muted text-sm mb-6">
            Choose a strong password to keep your celebration secure.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action(async () => {
                await api("/users/me/password", json("PATCH", password));
                await api("/auth/logout", json("POST"));
                client.clear();
                router.push("/login");
              }, "Password changed. Please sign in again.");
            }}
          >
            <Field label="Current password">
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password.currentPassword}
                onChange={(e) =>
                  setPassword({ ...password, currentPassword: e.target.value })
                }
              />
            </Field>
            <Field label="New password">
              <input
                required
                minLength={10}
                maxLength={128}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{10,128}"
                title="10+ characters, uppercase, lowercase and a number"
                type="password"
                autoComplete="new-password"
                value={password.newPassword}
                onChange={(e) =>
                  setPassword({ ...password, newPassword: e.target.value })
                }
              />
            </Field>
            <p className="muted text-sm mb-5">
              Use at least 10 characters with uppercase, lowercase and a number.
            </p>
            <Button type="submit" variant="outline" disabled={busy}>
              Update password
            </Button>
          </form>
        </section>
      </div>
      <p className="account-bottom">
        <Heart size={14} /> More love. Less admin.
      </p>
      <Dialog
        open={disconnect}
        onOpenChange={setDisconnect}
        title="Disconnect your calendar?"
      >
        <p className="muted mb-6">
          Your event participation stays saved. Calendar entries created by this
          app will be removed in the background.
        </p>
        <Button
          variant="destructive"
          disabled={busy}
          onClick={() =>
            action(async () => {
              await api("/google-calendar/disconnect", json("DELETE"));
              setDisconnect(false);
            }, "Calendar disconnected")
          }
        >
          Disconnect calendar
        </Button>
      </Dialog>
    </Shell>
  );
}

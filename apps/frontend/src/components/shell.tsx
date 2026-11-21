"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  LayoutDashboard,
  CalendarDays,
  Sparkles,
  UsersRound,
  Bookmark,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "./providers";
import { api, json } from "@/lib/api";
import { Button } from "./ui/button";
import { ReminderNotifications } from "./reminder-widget";
const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/events", label: "All events", icon: Sparkles },
  { href: "/my-events", label: "My team events", icon: UsersRound },
  { href: "/joined-events", label: "Joined events", icon: Bookmark },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-symbol">
        <Heart size={20} strokeWidth={1.4} />
      </span>
      <span>
        ever after<span className="brand-dot">.</span>
        <small>MADE FOR YOUR MOMENTS</small>
      </span>
    </Link>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  if (loading || !user)
    return (
      <div className="loading-page">
        <Heart className="pulse" />
        <p>Gathering your moments…</p>
      </div>
    );
  return (
    <div className="app-shell">
      <ReminderNotifications />
      <button
        className="mobile-toggle"
        aria-label="Toggle navigation"
        onClick={() => setMenu(!menu)}
      >
        {menu ? <X /> : <Menu />}
      </button>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Brand />
        <div className="wedding-label">
          <span className="tiny-flower">✳</span>
          <div>
            Your wedding workspace<small>Two families. One celebration.</small>
          </div>
        </div>
        <p className="nav-caption">THE CELEBRATION</p>
        <nav>
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              onClick={() => setMenu(false)}
              className={`nav-link ${path === href ? "active" : ""}`}
              key={href}
              href={href}
            >
              <Icon size={18} />
              {label}
              {path === href && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-art">❧</span>
          <h3>
            A little planning.
            <br />A lifetime of memories.
          </h3>
          <p>
            Make room for the moments
            <br />
            that matter most.
          </p>
          <Link href="/events/create">
            Plan a moment <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <Link className="nav-link" href="/settings">
            <Settings size={18} />
            Settings
          </Link>
          <button
            className="nav-link"
            onClick={async () => {
              await api("/auth/logout", json("POST"));
              client.clear();
              router.push("/login");
            }}
          >
            <LogOut size={18} />
            Sign out
          </button>
          <Link href="/profile" className="user-card">
            <span className={`avatar ${user.team.toLowerCase()}`}>
              {user.fullName
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              {user.fullName}
              <small>Team {user.team === "GROOM" ? "Groom" : "Bride"}</small>
            </span>
            <ChevronRight size={15} />
          </Link>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="muted">Your workspace</span>
            <ChevronRight size={13} />
            <span>
              {path.startsWith("/events/")
                ? "Event planning"
                : navigation.find((n) => n.href === path)?.label || "Account"}
            </span>
          </div>
          <div>
            <span className="together">
              <span /> Better, together
            </span>
            <Link
              href="/profile"
              className={`avatar small ${user.team.toLowerCase()}`}
            >
              {user.fullName[0]}
            </Link>
          </div>
        </header>
        <div className="page-content">{children}</div>
        <footer className="app-footer">
          Thoughtfully planned. Beautifully celebrated.
          <Heart size={12} /> ever after.
        </footer>
      </main>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title = "A beautiful beginning awaits",
  description = "Create your first event and start bringing the celebration together.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <Sparkles size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
      <Button asChild variant="outline">
        <Link href="/events/create">Create an event</Link>
      </Button>
    </div>
  );
}
export function Loading() {
  return (
    <div className="skeleton-grid">
      {[1, 2, 3].map((i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}

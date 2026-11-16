import Link from "next/link";
import {
  ArrowRight,
  Heart,
  CalendarDays,
  UsersRound,
  CheckCheck,
} from "lucide-react";
import { Brand } from "@/components/shell";
import { Button } from "@/components/ui/button";
export default function Home() {
  return (
    <main className="landing">
      <header>
        <Brand />
        <nav>
          <Link href="/login">Sign in</Link>
          <Button asChild>
            <Link href="/register">
              Start your story <ArrowRight size={15} />
            </Link>
          </Button>
        </nav>
      </header>
      <section className="landing-hero">
        <div>
          <span className="eyebrow">FOR YOUR BEAUTIFULLY SHARED BEGINNING</span>
          <h1>
            One celebration.
            <br />
            Two families.
            <br />
            <i>Endless memories.</i>
          </h1>
          <p>
            Bring your wedding plans and your favourite people together. A
            little less organising. A lot more celebrating.
          </p>
          <div className="landing-actions">
            <Button asChild>
              <Link href="/register">
                Plan your happily ever after <ArrowRight size={18} />
              </Link>
            </Button>
            <Link href="/login">Already planning? Sign in</Link>
          </div>
          <span className="landing-caption">
            <Heart size={14} /> Thoughtfully made for your once-in-a-lifetime.
          </span>
        </div>
        <div className="landing-visual">
          <div className="landing-arch">
            <span>❧</span>
            <Heart size={35} strokeWidth={1} />
            <h2>
              together
              <br />
              <i>
                is a beautiful
                <br />
                place to be.
              </i>
            </h2>
            <small>THE NEXT CHAPTER STARTS HERE</small>
          </div>
          <div className="floating-note">
            <CheckCheck size={19} />
            <span>
              Every detail, a little closer.
              <small>Your celebration, coming to life.</small>
            </span>
          </div>
          <span className="landing-spark">✧</span>
        </div>
      </section>
      <section className="landing-features">
        {[
          {
            icon: UsersRound,
            title: "Two teams. One beautiful day.",
            text: "Give both families space to plan their moments and share the joy.",
          },
          {
            icon: CheckCheck,
            title: "Love is in the little details.",
            text: "Turn every event’s preparations into a shared, checkable wishlist.",
          },
          {
            icon: CalendarDays,
            title: "Keep every moment close.",
            text: "Join celebrations and sync them to your own Google Calendar.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <article key={title}>
            <Icon size={22} />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <footer>
        Made for the moments that become memories. <span>ever after.</span>
      </footer>
    </main>
  );
}

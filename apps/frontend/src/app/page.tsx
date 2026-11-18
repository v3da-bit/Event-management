import {
  Heart,
  CalendarDays,
  UsersRound,
  CheckCheck,
} from "lucide-react";
import { Brand } from "@/components/shell";
import { HomeActions } from "@/components/home-actions";
export default function Home() {
  return (
    <main className="landing">
      <header>
        <Brand />
        <nav>
          <HomeActions />
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
            <HomeActions hero />
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

import Link from "next/link";
export default function NotFound() {
  return (
    <main className="loading-page">
      <h1>This moment wandered off.</h1>
      <p>We couldn’t find that page.</p>
      <Link href="/dashboard">Back to your celebration →</Link>
    </main>
  );
}

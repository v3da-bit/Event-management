"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="loading-page">
      <h1>A little pause in the plans.</h1>
      <p>Something went wrong. Please try again.</p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}

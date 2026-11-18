"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "./providers";
import { Button } from "./ui/button";

export function HomeActions({ hero = false }: { hero?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) return <span role="status">Loading your session…</span>;

  if (user) {
    return (
      <>
        <Button asChild>
          <Link href="/dashboard">
            {hero ? "Continue planning" : "Go to dashboard"}
            <ArrowRight size={hero ? 18 : 15} />
          </Link>
        </Button>
        <Link href="/profile">{hero ? "Your account" : user.fullName}</Link>
      </>
    );
  }

  const signIn = (
    <Link href="/login">{hero ? "Already planning? Sign in" : "Sign in"}</Link>
  );
  return (
    <>
      {!hero && signIn}
      <Button asChild>
        <Link href="/register">
          {hero ? "Plan your happily ever after" : "Start your story"}
          <ArrowRight size={hero ? 18 : 15} />
        </Link>
      </Button>
      {hero && signIn}
    </>
  );
}

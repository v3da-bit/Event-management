"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, Heart, Check } from "lucide-react";
import { api, json, User } from "@/lib/api";
import { Brand } from "./shell";
import { Button } from "./ui/button";
const schema = z.object({
  fullName: z.string(),
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
  confirmPassword: z.string(),
  team: z.enum(["GROOM", "BRIDE"]),
});
type Values = z.infer<typeof schema>;
export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const client = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      team: "BRIDE",
    },
  });
  async function submit(data: Values) {
    if (register) {
      if (data.fullName.trim().length < 2) {
        form.setError("fullName", { message: "Please enter your full name" });
        return;
      }
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/.test(data.password)) {
        form.setError("password", {
          message: "Use 10+ characters, uppercase, lowercase and a number",
        });
        return;
      }
      if (data.password !== data.confirmPassword) {
        form.setError("confirmPassword", { message: "Passwords do not match" });
        return;
      }
    }
    try {
      const user = await api<User>(
        `/auth/${register ? "register" : "login"}`,
        json(
          "POST",
          register
            ? {
                fullName: data.fullName,
                email: data.email,
                password: data.password,
                team: data.team,
              }
            : { email: data.email, password: data.password },
        ),
      );
      client.setQueryData(["me"], user);
      toast.success(register ? "Welcome to your next chapter" : "Welcome back");
      router.push("/dashboard");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">TWO FAMILIES. ONE BEAUTIFUL STORY.</span>
          <h1>
            A beautiful day
            <br />
            starts with
            <br />
            <i>coming together.</i>
          </h1>
          <p>
            A thoughtful little space for the people,
            <br />
            plans, and moments that mean everything.
          </p>
          <div className="story-divider" />
          <span className="story-small">
            <Heart size={16} /> Made with love. Planned together.
          </span>
        </div>
        <span className="auth-flower">❧</span>
      </aside>
      <main className="auth-main">
        <Link href="/" className="back-link">
          ← Back to ever after
        </Link>
        <form className="auth-form" onSubmit={form.handleSubmit(submit)}>
          <span className="eyebrow">YOUR CELEBRATION STARTS HERE</span>
          <h2>
            {register
              ? "Let’s write your next chapter."
              : "Welcome back, lovely."}
          </h2>
          <p>
            {register
              ? "Join your team and bring the big day to life."
              : "Your people, your plans, your happily ever after."}
          </p>
          {register && (
            <Field
              label="Full name"
              error={form.formState.errors.fullName?.message}
            >
              <input
                autoComplete="name"
                placeholder="Your full name"
                {...form.register("fullName")}
              />
            </Field>
          )}
          <Field
            label="Email address"
            error={form.formState.errors.email?.message}
          >
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...form.register("email")}
            />
          </Field>
          <Field
            label="Password"
            error={form.formState.errors.password?.message}
          >
            <input
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              placeholder={
                register ? "At least 10 characters" : "Your password"
              }
              {...form.register("password")}
            />
          </Field>
          {register && (
            <>
              <Field
                label="Confirm password"
                error={form.formState.errors.confirmPassword?.message}
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="One more time"
                  {...form.register("confirmPassword")}
                />
              </Field>
              <fieldset>
                <legend>Choose your team</legend>
                <div className="team-options">
                  {(["BRIDE", "GROOM"] as const).map((team) => (
                    <label
                      key={team}
                      className={`team-option ${team.toLowerCase()} ${form.watch("team") === team ? "chosen" : ""}`}
                    >
                      <input
                        type="radio"
                        value={team}
                        {...form.register("team")}
                      />
                      <Heart size={18} />
                      Team {team === "BRIDE" ? "Bride" : "Groom"}
                      {form.watch("team") === team && <Check size={14} />}
                    </label>
                  ))}
                </div>
                <small className="muted">
                  Your team is permanent and determines which events you can
                  manage.
                </small>
              </fieldset>
            </>
          )}
          <Button
            disabled={form.formState.isSubmitting}
            type="submit"
            className="w-full"
          >
            {form.formState.isSubmitting
              ? "Just a moment…"
              : register
                ? "Start planning together"
                : "Step into your celebration"}
            <ArrowRight size={17} />
          </Button>
          <p className="auth-switch">
            {register
              ? "Already part of the celebration?"
              : "New to the celebration?"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </form>
        <p className="auth-footnote">
          A little less stress. A little more celebration.
        </p>
      </main>
    </div>
  );
}
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}

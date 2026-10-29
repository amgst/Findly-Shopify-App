import { Form, Link, useNavigation } from "react-router";

export function safeNext(next: string | null) {
  // Only allow same-site paths under /dashboard, to avoid open redirects.
  if (!next) return "/dashboard";
  try {
    const base = "http://local.invalid";
    const u = new URL(next, base);
    if (u.origin === base && u.pathname.startsWith("/dashboard")) return u.pathname + u.search;
  } catch {
    // fall through
  }
  return "/dashboard";
}

export function AuthForm({
  mode,
  error,
  next,
}: {
  mode: "login" | "signup";
  error?: string;
  next: string;
}) {
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const isSignup = mode === "signup";
  return (
    <div className="web w-auth">
      <div className="w-auth-card">
        <Link to="/" className="w-logo">
          <span className="w-logo-mark" aria-hidden="true" />
          Pinpoint
        </Link>
        <h1>{isSignup ? "Create your store locator" : "Log in"}</h1>
        <p>{isSignup ? "Free to start. No credit card needed." : "Welcome back."}</p>
        {error && (
          <div className="w-error" role="alert">
            {error}
          </div>
        )}
        <Form method="post">
          <input type="hidden" name="next" value={next} />
          {isSignup && (
            <label className="w-field">
              Business name
              <input className="w-input" type="text" name="name" autoComplete="organization" />
            </label>
          )}
          <label className="w-field">
            Email
            <input className="w-input" type="email" name="email" required autoComplete="email" />
          </label>
          <label className="w-field">
            Password
            <input
              className="w-input"
              type="password"
              name="password"
              required
              minLength={isSignup ? 8 : undefined}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
          </label>
          <button className="w-btn w-btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}
          </button>
        </Form>
        <p className="w-auth-alt">
          {isSignup ? (
            <>
              Already have an account? <Link to="/login">Log in</Link>
            </>
          ) : (
            <>
              New here? <Link to="/signup">Create an account</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

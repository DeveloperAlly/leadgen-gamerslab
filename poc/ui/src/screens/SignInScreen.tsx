import { usePipeline } from "../state/PipelineProvider";
import { Logo, MailIcon, LockIcon, AlertIcon } from "../components/icons";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card } from "../components/ui/Card";
import { appConfig } from "../config/appConfig";
import { copy } from "../data/fixtures/copy";
import { space } from "../theme/tokens";

export function SignInScreen() {
  const { state, actions } = usePipeline();
  const loading = state.signinState === "loading";
  const error = state.signinState === "error";
  const passwordMode = appConfig.signinMode === "password";
  const tenant = state.tenant;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: space.xl,
      }}
    >
      <div className="rise" style={{ width: 380, maxWidth: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: space.xl }}>
          <Logo size={40} />
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: "14px 0 8px" }}>{tenant.name}</h1>
          <p
            style={{
              margin: 0,
              textAlign: "center",
              fontSize: 15,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {copy.signin.reassurance}
          </p>
        </div>

        <Card padding={26}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {passwordMode ? copy.signin.passwordLabel : copy.signin.emailLabel}
          </label>
          {passwordMode ? (
            <Input
              type="password"
              value={state.password}
              placeholder="Enter your password"
              leadingIcon={<LockIcon size={18} strokeWidth={2} />}
              autoFocus
              onChange={(e) => actions.setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && actions.signinContinue()}
            />
          ) : (
            <Input
              type="email"
              value={state.email}
              placeholder="you@studio.com"
              leadingIcon={<MailIcon size={18} strokeWidth={2} />}
              onChange={(e) => actions.setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && actions.signinContinue()}
            />
          )}

          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginTop: 10,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--danger)",
              }}
            >
              <AlertIcon size={15} strokeWidth={2} />
              {passwordMode ? copy.signin.passwordError : copy.signin.emailError}
            </div>
          )}

          <div style={{ marginTop: space.lg }}>
            <Button size="lg" fullWidth disabled={loading} onClick={actions.signinContinue}>
              {loading ? (
                <span className="spin" style={{ display: "flex" }}>
                  <Spinner />
                </span>
              ) : (
                "Continue"
              )}
            </Button>
          </div>

          {!passwordMode && (
            <>
              <Divider />
              <Button size="lg" variant="secondary" fullWidth onClick={actions.signinContinue}>
                <GoogleG />
                Continue with Google
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>or</span>
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function Spinner() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.35)" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function GoogleG() {
  return (
    <svg width={17} height={17} viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.94L3.98 7.28C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

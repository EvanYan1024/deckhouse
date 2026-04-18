import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useSocketStore } from "@/stores/socket-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";

export function SetupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((s) => s.login);
  const connect = useSocketStore((s) => s.connect);
  const connected = useSocketStore((s) => s.connected);
  const socket = useSocketStore((s) => s.socket);
  const setAuthenticated = useSocketStore((s) => s.setAuthenticated);
  const navigate = useNavigate();

  useEffect(() => {
    connect();
  }, [connect]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!socket || !connected) {
      setError("Not connected to server");
      return;
    }

    setLoading(true);
    socket.emit(
      "setup",
      { username, password },
      (res: { ok: boolean; token?: string; isAdmin?: boolean; msg?: string }) => {
        setLoading(false);
        if (res.ok && res.token) {
          // First setup user is always admin; backend also sends isAdmin: true
          login(res.token, username, res.isAdmin === true);
          // Backend already called afterLogin() for this socket; mirror that
          // into the store so effects gated on `authenticated` fire.
          setAuthenticated(true);
          navigate("/");
        } else {
          setError(res.msg ?? "Setup failed");
        }
      }
    );
  };

  const inputClass = "h-10 rounded-md border-border bg-background px-3 text-[15px]";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-border p-8">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Logo size={48} className="text-brand" />
          <h1 className="text-3xl">Deckhouse</h1>
          <p className="text-[15px] text-muted-foreground text-center">
            Create your admin account to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Username (min 3 chars)" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} autoFocus />
          <Input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          <Input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
          {error && <p className="text-[13px] text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full h-10 rounded-md bg-[#1c1c1c] text-[#fcfbf8] text-[15px] font-medium shadow-inset-btn hover:opacity-80 dark:bg-[#f7f4ed] dark:text-[#1c1c1c]"
            disabled={loading || !connected}
          >
            {!connected ? "Connecting..." : loading ? "Creating account..." : "Create Account"}
          </Button>
        </form>
      </div>
    </div>
  );
}

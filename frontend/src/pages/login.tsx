import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useSocketStore } from "@/stores/socket-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((s) => s.login);
  const connect = useSocketStore((s) => s.connect);
  const connected = useSocketStore((s) => s.connected);
  const socket = useSocketStore((s) => s.socket);
  const navigate = useNavigate();

  // Connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Once connected, check if setup is needed
  useEffect(() => {
    if (!connected || !socket) return;
    socket.emit("getInfo", (res: { ok: boolean; needSetup?: boolean }) => {
      if (res.ok && res.needSetup) {
        navigate("/setup");
      }
    });
  }, [connected, socket, navigate]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!socket || !connected) {
      setError("Not connected to server");
      return;
    }
    setError("");
    setLoading(true);

    socket.emit(
      "login",
      { username, password, token: "" },
      (res: { ok: boolean; token?: string; isAdmin?: boolean; msg?: string }) => {
        setLoading(false);
        if (res.ok && res.token) {
          login(res.token, username, res.isAdmin === true);
          navigate("/");
        } else {
          setError(res.msg ?? "Login failed");
        }
      }
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-border p-8">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Logo size={48} className="text-brand" />
          <h1 className="text-3xl">Deckhouse</h1>
          <p className="text-[15px] text-muted-foreground">
            Sign in to manage your stacks
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 rounded-md border-border bg-background px-3 text-[15px]"
            autoFocus
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 rounded-md border-border bg-background px-3 text-[15px]"
          />
          {error && (
            <p className="text-[13px] text-destructive">{error}</p>
          )}
          <Button
            type="submit"
            className="w-full h-10 rounded-md bg-[#1c1c1c] text-[#fcfbf8] text-[15px] font-medium shadow-inset-btn hover:opacity-80 dark:bg-[#f7f4ed] dark:text-[#1c1c1c]"
            disabled={loading || !connected}
          >
            {!connected ? "Connecting..." : loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}

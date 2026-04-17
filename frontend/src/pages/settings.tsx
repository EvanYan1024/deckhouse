import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { useThemeStore } from "@/stores/theme-store";
import { useSocketStore } from "@/stores/socket-store";
import { useAuthStore } from "@/stores/auth-store";
import { EnvEditor } from "@/components/stack/env-editor";
import { toast } from "sonner";

function General() {
  const socket = useSocketStore((s) => s.socket);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!socket) return;
    socket.emit("getSettings", (res: { ok: boolean; settings?: { primaryDomain: string } }) => {
      setLoading(false);
      if (res.ok && res.settings) {
        setPrimaryDomain(res.settings.primaryDomain);
      }
    });
  }, [socket]);

  const handleSave = () => {
    if (!socket) return;
    setSaving(true);
    socket.emit("setSettings", { primaryDomain }, (res: { ok: boolean; msg?: string }) => {
      setSaving(false);
      if (res.ok) {
        toast.success("Settings saved");
      } else {
        toast.error(res.msg ?? "Failed to save settings");
      }
    });
  };

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-[14px] text-foreground outline-none transition-shadow focus:ring-2 focus:ring-brand/30 focus:border-brand";

  if (loading) return <p className="text-[15px] text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h3>General</h3>
      <div className="max-w-sm space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-muted-foreground">Primary Domain</label>
          <input
            type="text"
            value={primaryDomain}
            onChange={(e) => setPrimaryDomain(e.target.value)}
            placeholder="e.g. example.com"
            className={inputClass}
            disabled={!isAdmin}
          />
          <p className="text-[12px] text-muted-foreground">Used for URL generation in the editor.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !isAdmin}
          title={!isAdmin ? "Admin privilege required" : undefined}
          className="rounded-lg bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground shadow-inset-btn transition-colors hover:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {!isAdmin && (
          <p className="text-[12px] text-muted-foreground">Only admins can change these settings.</p>
        )}
      </div>
    </div>
  );
}

function Appearance() {
  const { theme, setTheme } = useThemeStore();
  const options: Array<{ value: "light" | "dark" | "system"; label: string }> = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

  return (
    <div className="space-y-4">
      <h3>Theme</h3>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`rounded-lg px-4 py-2 text-[14px] font-medium transition-colors ${
              theme === opt.value
                ? "bg-brand text-brand-foreground shadow-[0px_0px_0px_1px_var(--brand)]"
                : "bg-muted text-muted-foreground shadow-[0px_0px_0px_1px_var(--border)] hover:opacity-80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Security() {
  const socket = useSocketStore((s) => s.socket);
  const username = useAuthStore((s) => s.username);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const login = useAuthStore((s) => s.login);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (!socket || !username) return;

    setLoading(true);
    socket.emit(
      "changePassword",
      { currentPassword, newPassword },
      (res: { ok: boolean; msg?: string; token?: string }) => {
        setLoading(false);
        if (res.ok && res.token) {
          // Role doesn't change on password change; preserve current isAdmin
          login(res.token, username, isAdmin);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          toast.success("Password changed");
        } else {
          toast.error(res.msg ?? "Failed to change password");
        }
      }
    );
  };

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-[14px] text-foreground outline-none transition-shadow focus:ring-2 focus:ring-brand/30 focus:border-brand";

  return (
    <div className="space-y-6">
      <h3>Change Password</h3>
      <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-muted-foreground">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-muted-foreground">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
            required
            minLength={6}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-muted-foreground">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            required
            minLength={6}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground shadow-inset-btn transition-colors hover:opacity-80 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Change Password"}
        </button>
      </form>
    </div>
  );
}

function Environment() {
  const socket = useSocketStore((s) => s.socket);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [globalEnv, setGlobalEnv] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!socket) return;
    socket.emit("getGlobalEnv", (res: { ok: boolean; globalEnv?: string }) => {
      setLoading(false);
      if (res.ok) {
        setGlobalEnv(res.globalEnv ?? "");
      }
    });
  }, [socket]);

  const handleSave = () => {
    if (!socket) return;
    setSaving(true);
    socket.emit("setGlobalEnv", globalEnv, (res: { ok: boolean; msg?: string }) => {
      setSaving(false);
      if (res.ok) {
        toast.success("Global environment saved");
      } else {
        toast.error(res.msg ?? "Failed to save");
      }
    });
  };

  if (loading) return <p className="text-[15px] text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h3>Global Environment Variables</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Shared .env variables applied to all stacks. Stack-level .env takes precedence.
        </p>
      </div>
      <EnvEditor value={globalEnv} onChange={setGlobalEnv} readOnly={!isAdmin} />
      <button
        onClick={handleSave}
        disabled={saving || !isAdmin}
        title={!isAdmin ? "Admin privilege required" : undefined}
        className="rounded-lg bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground shadow-inset-btn transition-colors hover:opacity-80 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {!isAdmin && (
        <p className="text-[12px] text-muted-foreground">Only admins can change global env.</p>
      )}
    </div>
  );
}

function About() {
  return (
    <div className="space-y-4">
      <h3>About</h3>
      <div className="space-y-2">
        <p className="text-[15px] text-foreground">Deckhouse v0.1.0</p>
        <p className="text-[14px] text-muted-foreground">
          A self-hosted Docker Compose manager with built-in file browser.
        </p>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-[14px] text-brand hover:underline"
        >
          GitHub Repository
        </a>
      </div>
    </div>
  );
}

interface ListedUser {
  id: number;
  username: string;
  isAdmin: boolean;
}

function Users() {
  const socket = useSocketStore((s) => s.socket);
  const currentUsername = useAuthStore((s) => s.username);
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchUsers = useCallback(() => {
    if (!socket) return;
    socket.emit("listUsers", (res: { ok: boolean; users?: ListedUser[] }) => {
      if (res.ok && res.users) setUsers(res.users);
    });
  }, [socket]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;
    setAdding(true);
    socket.emit(
      "addUser",
      { username: newUsername, password: newPassword, isAdmin: newIsAdmin },
      (res: { ok: boolean; msg?: string }) => {
        setAdding(false);
        if (res.ok) {
          toast.success("User added");
          setNewUsername("");
          setNewPassword("");
          setNewIsAdmin(false);
          fetchUsers();
        } else {
          toast.error(res.msg ?? "Failed to add user");
        }
      }
    );
  };

  const handleDelete = (username: string) => {
    if (!socket) return;
    socket.emit("deleteUser", username, (res: { ok: boolean; msg?: string }) => {
      if (res.ok) {
        toast.success("User deleted");
        fetchUsers();
      } else {
        toast.error(res.msg ?? "Failed to delete user");
      }
    });
  };

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-[14px] text-foreground outline-none transition-shadow focus:ring-2 focus:ring-brand/30 focus:border-brand";

  return (
    <div className="space-y-6">
      <h3>Users</h3>

      {/* User list */}
      <div className="rounded-lg border border-border divide-y divide-border">
        {users.map((user) => {
          const isSelf = user.username === currentUsername;
          return (
            <div key={user.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-foreground">{user.username}</span>
                {user.isAdmin && (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                    admin
                  </span>
                )}
                {isSelf && (
                  <span className="text-[11px] text-muted-foreground">(you)</span>
                )}
              </div>
              <button
                onClick={() => handleDelete(user.username)}
                disabled={isSelf}
                title={isSelf ? "You cannot delete your own account" : undefined}
                className="text-[12px] text-destructive hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          );
        })}
        {users.length === 0 && (
          <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No users</p>
        )}
      </div>

      {/* Add user form */}
      <div>
        <h3 className="text-[15px] font-semibold text-foreground mb-3">Add User</h3>
        <form onSubmit={handleAdd} className="max-w-lg space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <label className="block text-[12px] font-medium text-muted-foreground">Username</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className={inputClass}
                required
                minLength={3}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-[12px] font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground shadow-inset-btn transition-colors hover:opacity-80 disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
          <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
            <input
              type="checkbox"
              checked={newIsAdmin}
              onChange={(e) => setNewIsAdmin(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Grant admin privileges
          </label>
        </form>
      </div>
    </div>
  );
}

function Agents() {
  const socket = useSocketStore((s) => s.socket);
  const agentStatusList = useSocketStore((s) => s.agentStatusList);
  const [agents, setAgents] = useState<Record<string, { url: string; name: string; endpoint: string }>>({});
  const [url, setUrl] = useState("");
  const [agentUsername, setAgentUsername] = useState("");
  const [agentPassword, setAgentPassword] = useState("");
  const [agentName, setAgentName] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchAgents = useCallback(() => {
    if (!socket) return;
    socket.emit("getAgentList", (res: { ok: boolean; agentList?: Record<string, { url: string; name: string; endpoint: string }> }) => {
      if (res.ok && res.agentList) setAgents(res.agentList);
    });
  }, [socket]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;
    setAdding(true);
    socket.emit("addAgent", { url, username: agentUsername, password: agentPassword, name: agentName },
      (res: { ok: boolean; msg?: string }) => {
        setAdding(false);
        if (res.ok) {
          toast.success("Agent added");
          setUrl(""); setAgentUsername(""); setAgentPassword(""); setAgentName("");
          fetchAgents();
        } else {
          toast.error(res.msg ?? "Failed to add agent");
        }
      }
    );
  };

  const handleRemove = (endpoint: string) => {
    if (!socket) return;
    socket.emit("removeAgent", endpoint, (res: { ok: boolean; msg?: string }) => {
      if (res.ok) {
        toast.success("Agent removed");
        fetchAgents();
      } else {
        toast.error(res.msg ?? "Failed to remove agent");
      }
    });
  };

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-[14px] text-foreground outline-none transition-shadow focus:ring-2 focus:ring-brand/30 focus:border-brand";

  const agentEntries = Object.values(agents);

  return (
    <div className="space-y-6">
      <div>
        <h3>Remote Agents</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Manage Docker stacks on remote servers through a single UI.
        </p>
      </div>

      {/* Agent list */}
      <div className="rounded-lg border border-border divide-y divide-border">
        {agentEntries.map((agent) => {
          const status = agentStatusList[agent.endpoint] ?? "offline";
          return (
            <div key={agent.endpoint} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="text-[14px] font-medium text-foreground">{agent.name}</span>
                <span className="ml-2 text-[12px] text-muted-foreground">{agent.url}</span>
                <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  status === "online"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : status === "connecting"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {status}
                </span>
              </div>
              <button
                onClick={() => handleRemove(agent.endpoint)}
                className="text-[12px] text-destructive hover:underline"
              >
                Remove
              </button>
            </div>
          );
        })}
        {agentEntries.length === 0 && (
          <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No remote agents configured</p>
        )}
      </div>

      {/* Add agent form */}
      <div>
        <h3 className="text-[15px] font-semibold text-foreground mb-3">Add Agent</h3>
        <form onSubmit={handleAdd} className="max-w-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[12px] font-medium text-muted-foreground">URL</label>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="http://host:5001" className={inputClass} required />
            </div>
            <div className="space-y-1">
              <label className="block text-[12px] font-medium text-muted-foreground">Display Name</label>
              <input type="text" value={agentName} onChange={(e) => setAgentName(e.target.value)}
                placeholder="Production Server" className={inputClass} required />
            </div>
            <div className="space-y-1">
              <label className="block text-[12px] font-medium text-muted-foreground">Username</label>
              <input type="text" value={agentUsername} onChange={(e) => setAgentUsername(e.target.value)}
                className={inputClass} required />
            </div>
            <div className="space-y-1">
              <label className="block text-[12px] font-medium text-muted-foreground">Password</label>
              <input type="password" value={agentPassword} onChange={(e) => setAgentPassword(e.target.value)}
                className={inputClass} required />
            </div>
          </div>
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground shadow-inset-btn transition-colors hover:opacity-80 disabled:opacity-50"
          >
            {adding ? "Testing connection…" : "Add Agent"}
          </button>
        </form>
      </div>
    </div>
  );
}

const tabs: Array<{ path: string; label: string; adminOnly?: boolean }> = [
  { path: "general", label: "General" },
  { path: "appearance", label: "Appearance" },
  { path: "environment", label: "Environment" },
  { path: "users", label: "Users", adminOnly: true },
  { path: "agents", label: "Agents" },
  { path: "security", label: "Security" },
  { path: "about", label: "About" },
];

export function SettingsPage() {
  const location = useLocation();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div>
      <h1 className="text-[2rem] mb-8">
        Settings
      </h1>

      <div className="flex gap-6">
        <nav className="w-48 space-y-0.5">
          {visibleTabs.map((tab) => {
            const isActive = location.pathname.endsWith(tab.path);
            return (
              <Link
                key={tab.path}
                to={`/settings/${tab.path}`}
                className={`block rounded-lg px-3 py-2 text-[14px] transition-colors ${
                  isActive
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 rounded-2xl border border-border bg-card p-6">
          <Routes>
            <Route path="general" element={<General />} />
            <Route path="appearance" element={<Appearance />} />
            <Route path="environment" element={<Environment />} />
            {/* Users route is only mounted for admins — non-admin deep-links
                fall through to the catch-all below and get redirected */}
            {isAdmin && <Route path="users" element={<Users />} />}
            <Route path="agents" element={<Agents />} />
            <Route path="security" element={<Security />} />
            <Route path="about" element={<About />} />
            <Route path="*" element={<Navigate to="general" />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

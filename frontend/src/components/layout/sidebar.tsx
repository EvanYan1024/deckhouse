import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSocketStore } from "@/stores/socket-store";
import { useAuthStore } from "@/stores/auth-store";
import { Settings, Circle, Plus, Search, TerminalSquare } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Logo } from "./logo";

type StatusFilter = "all" | "running" | "stopped";

export function Sidebar() {
  const location = useLocation();
  const connected = useSocketStore((s) => s.connected);
  const stackList = useSocketStore((s) => s.stackList);
  const agentStackList = useSocketStore((s) => s.agentStackList);
  const agentList = useSocketStore((s) => s.agentList);
  const agentStatusList = useSocketStore((s) => s.agentStatusList);
  const stacks = Object.values(stackList);
  const socket = useSocketStore((s) => s.socket);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [consoleEnabled, setConsoleEnabled] = useState(false);

  useEffect(() => {
    if (!socket) return;
    socket.emit("getInfo", (res: { ok: boolean; consoleEnabled?: boolean }) => {
      if (res.ok) setConsoleEnabled(!!res.consoleEnabled);
    });
  }, [socket]);

  const filteredStacks = useMemo(() => {
    return stacks.filter((stack) => {
      if (search && !stack.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter === "running" && stack.status !== 3) return false;
      if (statusFilter === "stopped" && stack.status === 3) return false;
      return true;
    });
  }, [stacks, search, statusFilter]);

  return (
    <aside className="flex h-full w-60 flex-col border-r border-[#e8e6dc] bg-[#faf9f5] dark:border-[#30302e] dark:bg-[#1e1e1c]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo size={28} className="text-[#c96442] shrink-0" />
        <span className="text-xl font-semibold text-foreground">
          Deckhouse
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Circle
            className={`h-2 w-2 fill-current ${connected ? "text-green-600" : "text-[#b53333]"}`}
          />
          <span className="text-[10px] text-[#87867f]">
            {connected ? "online" : "offline"}
          </span>
        </span>
      </div>

      <Separator className="bg-[#e8e6dc] dark:bg-[#30302e]" />

      {/* Stack List */}
      <nav className="flex-1 overflow-auto px-3 py-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-[#87867f]">
            Stacks
          </span>
          <Link
            to="/compose"
            className="rounded-md p-1 text-[#87867f] transition-colors hover:bg-[#f0eee6] hover:text-[#4d4c48] dark:hover:bg-[#30302e]"
            title="New Stack"
          >
            <Plus className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Search & filter */}
        {stacks.length > 0 && (
          <div className="px-1 mb-2 space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border border-input bg-background py-1 pl-6 pr-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-brand/30"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "running", "stopped"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium capitalize transition-colors ${
                    statusFilter === f
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {stacks.length === 0 && (
          <p className="px-2 py-6 text-center text-[13px] text-[#87867f]">
            No stacks yet
          </p>
        )}

        <div className="space-y-0.5">
          {filteredStacks.map((stack) => {
            const isActive = location.pathname === `/compose/${stack.name}`;
            const isRunning = stack.status === 3;
            return (
              <Link
                key={stack.name}
                to={`/compose/${stack.name}`}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] transition-colors ${
                  isActive
                    ? "bg-[#f0eee6] text-[#141413] ring-warm dark:bg-[#30302e] dark:text-[#faf9f5]"
                    : "text-[#5e5d59] hover:bg-[#f0eee6] hover:text-[#141413] dark:text-[#b0aea5] dark:hover:bg-[#30302e] dark:hover:text-[#faf9f5]"
                }`}
              >
                <Circle
                  className={`h-2 w-2 shrink-0 fill-current ${
                    isRunning ? "text-green-600" : "text-[#d1cfc5] dark:text-[#5e5d59]"
                  }`}
                />
                <span className="truncate">{stack.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Remote agent stacks */}
        {Object.entries(agentStackList).map(([endpoint, remoteStacks]) => {
          const agent = agentList[endpoint];
          const status = agentStatusList[endpoint] ?? "offline";
          const remoteStackValues = Object.values(remoteStacks);
          if (!agent) return null;
          return (
            <div key={endpoint} className="mt-4">
              <div className="flex items-center gap-1.5 px-2 mb-1">
                <Circle className={`h-1.5 w-1.5 fill-current ${
                  status === "online" ? "text-green-600" : status === "connecting" ? "text-amber-500" : "text-muted-foreground/40"
                }`} />
                <span className="text-[10px] font-medium uppercase tracking-[0.5px] text-muted-foreground truncate">
                  {agent.name}
                </span>
              </div>
              <div className="space-y-0.5">
                {remoteStackValues.map((stack) => {
                  const isActive = location.pathname === `/compose/${stack.name}/${endpoint}`;
                  const isRunning = stack.status === 3;
                  return (
                    <Link
                      key={`${endpoint}-${stack.name}`}
                      to={`/compose/${stack.name}/${endpoint}`}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] transition-colors ${
                        isActive
                          ? "bg-[#f0eee6] text-[#141413] dark:bg-[#30302e] dark:text-[#faf9f5]"
                          : "text-[#5e5d59] hover:bg-[#f0eee6] hover:text-[#141413] dark:text-[#b0aea5] dark:hover:bg-[#30302e] dark:hover:text-[#faf9f5]"
                      }`}
                    >
                      <Circle className={`h-2 w-2 shrink-0 fill-current ${
                        isRunning ? "text-green-600" : "text-[#d1cfc5] dark:text-[#5e5d59]"
                      }`} />
                      <span className="truncate">{stack.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      </nav>

      <Separator className="bg-[#e8e6dc] dark:bg-[#30302e]" />

      {/* Bottom Nav */}
      <div className="px-3 py-3 space-y-0.5">
        {consoleEnabled && isAdmin && (
          <Link
            to="/console"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-[#5e5d59] transition-colors hover:bg-[#f0eee6] hover:text-[#141413] dark:text-[#b0aea5] dark:hover:bg-[#30302e] dark:hover:text-[#faf9f5]"
          >
            <TerminalSquare className="h-4 w-4" />
            Console
          </Link>
        )}
        <Link
          to="/settings/general"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-[#5e5d59] transition-colors hover:bg-[#f0eee6] hover:text-[#141413] dark:text-[#b0aea5] dark:hover:bg-[#30302e] dark:hover:text-[#faf9f5]"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}

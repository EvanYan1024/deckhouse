import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSocketStore } from "@/stores/socket-store";
import { Plus, Circle, Search } from "lucide-react";

type StatusFilter = "all" | "running" | "stopped";

export function DashboardPage() {
  const stackList = useSocketStore((s) => s.stackList);
  const stacks = Object.values(stackList);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredStacks = useMemo(() => {
    return stacks.filter((stack) => {
      if (search && !stack.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter === "running" && stack.status !== 3) return false;
      if (statusFilter === "stopped" && stack.status === 3) return false;
      return true;
    });
  }, [stacks, search, statusFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[2rem]">Dashboard</h1>
        <button
          onClick={() => navigate("/compose")}
          className="inline-flex items-center gap-2 rounded-md bg-[#1c1c1c] px-4 py-2 text-[15px] font-medium text-[#fcfbf8] shadow-inset-btn transition-colors hover:opacity-80 dark:bg-[#f7f4ed] dark:text-[#1c1c1c]"
        >
          <Plus className="h-4 w-4" />
          New Stack
        </button>
      </div>

      {stacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border py-20">
          <p className="text-xl font-semibold text-foreground">No stacks yet</p>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Create your first Docker Compose stack to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Search & filter */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stacks..."
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-[14px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "running", "stopped"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-lg px-3 py-2 text-[13px] font-medium capitalize transition-colors ${
                    statusFilter === f
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredStacks.length === 0 ? (
            <p className="text-center text-[15px] text-muted-foreground py-10">
              No stacks match your search.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredStacks.map((stack) => {
                const isRunning = stack.status === 3;
                return (
                  <Link
                    key={stack.name}
                    to={`/compose/${stack.name}`}
                    className="group rounded-xl border border-border p-5 transition-all hover:shadow-focus"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-[1.1rem]">
                        {stack.name}
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <Circle
                          className={`h-2.5 w-2.5 fill-current ${
                            isRunning ? "text-green-600" : "text-muted-foreground/40"
                          }`}
                        />
                        <span className="text-[12px] text-muted-foreground">
                          {isRunning ? "Running" : "Stopped"}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

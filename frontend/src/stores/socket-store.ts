import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import type { Stack } from "@/types/stack";
import type { Agent, AgentStatus } from "@/types/agent";
import { useAuthStore } from "./auth-store";

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  authenticated: boolean;
  stackList: Record<string, Stack>;
  agentStackList: Record<string, Record<string, Stack>>;
  agentList: Record<string, Agent>;
  agentStatusList: Record<string, AgentStatus>;

  connect: () => void;
  disconnect: () => void;
  emitAgent: (endpoint: string, event: string, ...args: unknown[]) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  authenticated: false,
  stackList: {},
  agentStackList: {},
  agentList: {},
  agentStatusList: {},

  connect: () => {
    const existing = get().socket;
    if (existing?.connected) return;

    // Clean up old socket if it exists but is disconnected
    if (existing) {
      existing.removeAllListeners();
      existing.disconnect();
    }

    const socket = io(window.location.origin, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      set({ connected: true, authenticated: false });

      const token = useAuthStore.getState().token;
      if (token) {
        socket.emit(
          "loginByToken",
          token,
          (res: { ok: boolean; isAdmin?: boolean }) => {
            if (res.ok) {
              set({ authenticated: true });
              // Refresh isAdmin from the server each reconnect — localStorage
              // value is a cache, not the source of truth
              useAuthStore.getState().setIsAdmin(res.isAdmin === true);
            } else {
              useAuthStore.getState().logout();
            }
          }
        );
      }
    });

    socket.on("disconnect", () => {
      set({ connected: false, authenticated: false });
    });

    socket.on("stackList", (data: Record<string, Stack>) => {
      set({ stackList: data });
    });

    socket.on(
      "agentStackList",
      (endpoint: string, data: Record<string, Stack>) => {
        set((state) => ({
          agentStackList: {
            ...state.agentStackList,
            [endpoint]: data,
          },
        }));
      }
    );

    socket.on("agentList", (data: Record<string, Agent>) => {
      set({ agentList: data });
    });

    socket.on(
      "agentStatus",
      (endpoint: string, status: AgentStatus) => {
        set((state) => ({
          agentStatusList: {
            ...state.agentStatusList,
            [endpoint]: status,
          },
        }));
      }
    );

    set({ socket });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    set({ socket: null, connected: false, authenticated: false });
  },

  emitAgent: (endpoint, event, ...args) => {
    const { socket } = get();
    if (!socket) return;
    socket.emit("agent", endpoint, event, ...args);
  },
}));

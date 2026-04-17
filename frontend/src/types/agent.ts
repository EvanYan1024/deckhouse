export interface Agent {
  url: string;
  username: string;
  password: string;
  name: string;
  endpoint: string;
}

export type AgentStatus = "online" | "offline" | "connecting";

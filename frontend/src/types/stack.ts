export interface Stack {
  name: string;
  status: number;
  tags: string[];
  isManagedByDockge: boolean;
  composeYAML: string;
  composeENV: string;
  endpoint: string;
}

export interface ContainerInfo {
  name: string;
  service: string;
  state: string;
  status: string;
  image: string;
  ports: string[];
}

export type StackStatus = "running" | "exited" | "inactive" | "created_file";

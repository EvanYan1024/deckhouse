export interface FileEntry {
  name: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  modifiedAt: string;
  type: "directory" | "text" | "image" | "video" | "audio" | "binary";
  extension: string;
}

export interface FileContent {
  content: string;
  encoding: "utf-8" | "base64";
  size: number;
  readOnly: boolean;
  tooLarge: boolean;
}

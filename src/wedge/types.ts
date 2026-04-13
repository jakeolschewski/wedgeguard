export interface Wedge {
  id: string;
  code: string;
  reason: string;
  filePath: string;
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
  createdAt: string;
  language: string;
  embedding?: number[];
}

export interface WedgeStore {
  version: number;
  wedges: Wedge[];
}

export interface OllamaChatMessage {
  role: string;
  content: string;
}

export interface OllamaResponse {
  model: string;
  message: OllamaChatMessage;
  done: boolean;
}

export interface OllamaEmbeddingResponse {
  embedding: number[];
}

export interface OllamaListResponse {
  models: Array<{ name: string; modified_at: string; size: number }>;
}

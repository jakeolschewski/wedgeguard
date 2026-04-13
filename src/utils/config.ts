import * as vscode from 'vscode';

export interface WedgeGuardConfig {
  ollamaUrl: string;
  model: string;
  embeddingModel: string;
  maxWedgeContext: number;
}

export function getConfig(): WedgeGuardConfig {
  const cfg = vscode.workspace.getConfiguration('wedgeguard');
  return {
    ollamaUrl: cfg.get<string>('ollamaUrl', 'http://localhost:11434'),
    model: cfg.get<string>('model', 'qwen2.5-coder:7b'),
    embeddingModel: cfg.get<string>('embeddingModel', 'nomic-embed-text'),
    maxWedgeContext: cfg.get<number>('maxWedgeContext', 10),
  };
}

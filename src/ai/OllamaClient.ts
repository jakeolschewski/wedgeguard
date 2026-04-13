import { getConfig } from '../utils/config';
import { OllamaChatMessage, OllamaEmbeddingResponse, OllamaListResponse } from '../wedge/types';

export class OllamaClient {
  private get baseUrl(): string {
    return getConfig().ollamaUrl;
  }

  private get model(): string {
    return getConfig().model;
  }

  private get embeddingModel(): string {
    return getConfig().embeddingModel;
  }

  /**
   * Checks if Ollama is running and reachable.
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Lists available models from Ollama.
   */
  public async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return [];
      }
      const data = (await response.json()) as OllamaListResponse;
      return (data.models ?? []).map(m => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Sends a chat request to Ollama and returns the full response text.
   * Uses non-streaming mode for simplicity.
   */
  public async chat(messages: OllamaChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama chat error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      message?: { content?: string };
      done?: boolean;
    };
    return data.message?.content ?? '';
  }

  /**
   * Sends a chat request and streams the response, calling the callback for each chunk.
   */
  public async chatStream(
    messages: OllamaChatMessage[],
    onChunk: (text: string) => void
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama stream error ${response.status}: ${body}`);
    }

    if (!response.body) {
      throw new Error('No response body from Ollama');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        try {
          const parsed = JSON.parse(trimmed) as {
            message?: { content?: string };
            done?: boolean;
          };
          const content = parsed.message?.content ?? '';
          if (content) {
            onChunk(content);
            fullText += content;
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    return fullText;
  }

  /**
   * Gets an embedding vector for the given text.
   * Returns an empty array if embeddings are unavailable.
   */
  public async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.embeddingModel,
          prompt: text,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as OllamaEmbeddingResponse;
      return data.embedding ?? [];
    } catch {
      return [];
    }
  }
}

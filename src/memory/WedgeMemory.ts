import { Wedge } from '../wedge/types';
import { OllamaClient } from '../ai/OllamaClient';
import { cosineSimilarity, keywordSimilarity } from './similarity';

export interface ScoredWedge {
  wedge: Wedge;
  score: number;
}

export class WedgeMemory {
  private client: OllamaClient;

  constructor(client: OllamaClient) {
    this.client = client;
  }

  /**
   * Finds the most relevant wedges for a query using embeddings or keyword fallback.
   */
  public async findRelevant(
    query: string,
    wedges: Wedge[],
    topN: number
  ): Promise<Wedge[]> {
    if (wedges.length === 0) {
      return [];
    }

    const ollamaAvailable = await this.client.isAvailable();

    if (ollamaAvailable) {
      try {
        return await this.findRelevantByEmbedding(query, wedges, topN);
      } catch {
        // Fall through to keyword fallback
      }
    }

    return this.findRelevantByKeyword(query, wedges, topN);
  }

  private async findRelevantByEmbedding(
    query: string,
    wedges: Wedge[],
    topN: number
  ): Promise<Wedge[]> {
    const queryEmbedding = await this.client.embed(query);
    if (!queryEmbedding || queryEmbedding.length === 0) {
      return this.findRelevantByKeyword(query, wedges, topN);
    }

    const scored: ScoredWedge[] = [];

    for (const wedge of wedges) {
      let score: number;
      if (wedge.embedding && wedge.embedding.length > 0) {
        score = cosineSimilarity(queryEmbedding, wedge.embedding);
      } else {
        // No embedding for this wedge yet — use keyword as fallback score
        score = keywordSimilarity(query, wedge.code + ' ' + wedge.reason);
      }
      scored.push({ wedge, score });
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map(s => s.wedge);
  }

  private findRelevantByKeyword(
    query: string,
    wedges: Wedge[],
    topN: number
  ): Wedge[] {
    const scored: ScoredWedge[] = wedges.map(wedge => ({
      wedge,
      score: keywordSimilarity(query, wedge.code + ' ' + wedge.reason),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map(s => s.wedge);
  }

  /**
   * Builds a style snapshot summary from accumulated wedges.
   * Analyzes patterns in wedged code to infer user preferences.
   */
  public buildStyleSnapshot(wedges: Wedge[]): string {
    if (wedges.length === 0) {
      return 'No style patterns accumulated yet.';
    }

    const languages = new Map<string, number>();
    const reasonKeywords: string[] = [];
    let totalLines = 0;

    for (const wedge of wedges) {
      const lang = wedge.language || 'unknown';
      languages.set(lang, (languages.get(lang) ?? 0) + 1);
      reasonKeywords.push(...wedge.reason.toLowerCase().split(/\s+/));
      totalLines += wedge.endLine - wedge.startLine + 1;
    }

    const topLang = [...languages.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang, count]) => `${lang} (${count})`)
      .join(', ');

    const avgLines = Math.round(totalLines / wedges.length);

    // Count reason frequency
    const reasonCounts = new Map<string, number>();
    for (const kw of reasonKeywords) {
      if (kw.length > 3) {
        reasonCounts.set(kw, (reasonCounts.get(kw) ?? 0) + 1);
      }
    }
    const topReasons = [...reasonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kw]) => kw)
      .join(', ');

    const lines: string[] = [
      `- Primary languages: ${topLang}`,
      `- Average wedge size: ~${avgLines} lines`,
      `- Total protected code blocks: ${wedges.length}`,
    ];
    if (topReasons) {
      lines.push(`- Common protection themes: ${topReasons}`);
    }

    // Detect common patterns in code
    const codeJoined = wedges.map(w => w.code).join('\n');
    const patterns: string[] = [];
    if (/async\s+function|async\s*\(/.test(codeJoined)) {
      patterns.push('async/await patterns');
    }
    if (/interface\s+\w+|type\s+\w+\s*=/.test(codeJoined)) {
      patterns.push('TypeScript type definitions');
    }
    if (/class\s+\w+/.test(codeJoined)) {
      patterns.push('class-based architecture');
    }
    if (/const\s+\w+\s*=\s*\(/.test(codeJoined)) {
      patterns.push('functional/arrow function style');
    }
    if (/try\s*{/.test(codeJoined)) {
      patterns.push('explicit error handling');
    }
    if (patterns.length > 0) {
      lines.push(`- Detected coding patterns: ${patterns.join(', ')}`);
    }

    return lines.join('\n');
  }
}

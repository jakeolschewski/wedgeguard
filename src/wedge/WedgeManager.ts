import * as vscode from 'vscode';
import { Wedge, WedgeStore } from './types';
import { loadStore, saveStore, loadStoreFromFile, saveStoreToFile } from '../utils/storage';

function generateId(): string {
  return `wedge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class WedgeManager {
  private store: WedgeStore;
  private context: vscode.ExtensionContext;
  private _onDidChange = new vscode.EventEmitter<void>();

  public readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.store = loadStore(context);
  }

  private persist(): void {
    saveStore(this.context, this.store);
    this._onDidChange.fire();
  }

  public getAll(): Wedge[] {
    return [...this.store.wedges];
  }

  public getById(id: string): Wedge | undefined {
    return this.store.wedges.find(w => w.id === id);
  }

  public getForFile(filePath: string): Wedge[] {
    return this.store.wedges.filter(w => w.filePath === filePath);
  }

  public create(params: Omit<Wedge, 'id' | 'createdAt'>): Wedge {
    const wedge: Wedge = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      ...params,
    };
    this.store.wedges.push(wedge);
    this.persist();
    return wedge;
  }

  public updateEmbedding(id: string, embedding: number[]): void {
    const wedge = this.store.wedges.find(w => w.id === id);
    if (wedge) {
      wedge.embedding = embedding;
      this.persist();
    }
  }

  public remove(id: string): boolean {
    const idx = this.store.wedges.findIndex(w => w.id === id);
    if (idx === -1) {
      return false;
    }
    this.store.wedges.splice(idx, 1);
    this.persist();
    return true;
  }

  public clearAll(): void {
    this.store.wedges = [];
    this.persist();
  }

  public count(): number {
    return this.store.wedges.length;
  }

  /**
   * Returns true if the given range in a file overlaps with any existing wedge.
   */
  public overlapsAnyWedge(
    filePath: string,
    startLine: number,
    endLine: number
  ): Wedge | undefined {
    return this.store.wedges.find(w => {
      if (w.filePath !== filePath) {
        return false;
      }
      // Overlap check: ranges overlap if one starts before the other ends
      return startLine <= w.endLine && endLine >= w.startLine;
    });
  }

  public getByFile(): Map<string, Wedge[]> {
    const map = new Map<string, Wedge[]>();
    for (const wedge of this.store.wedges) {
      const existing = map.get(wedge.filePath) ?? [];
      existing.push(wedge);
      map.set(wedge.filePath, existing);
    }
    return map;
  }

  public exportToFile(filePath: string): void {
    saveStoreToFile(filePath, this.store);
  }

  public importFromFile(filePath: string): number {
    const imported = loadStoreFromFile(filePath);
    if (!imported) {
      throw new Error(`Could not read wedge store from: ${filePath}`);
    }
    let added = 0;
    for (const wedge of imported.wedges) {
      // Avoid duplicates by ID
      if (!this.store.wedges.some(w => w.id === wedge.id)) {
        this.store.wedges.push(wedge);
        added++;
      }
    }
    if (added > 0) {
      this.persist();
    }
    return added;
  }

  public dispose(): void {
    this._onDidChange.dispose();
  }
}

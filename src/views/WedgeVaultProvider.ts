import * as vscode from 'vscode';
import { WedgeManager } from '../wedge/WedgeManager';
import { WedgeVaultItem } from './WedgeVaultItem';
import { Wedge } from '../wedge/types';

export class WedgeVaultProvider implements vscode.TreeDataProvider<WedgeVaultItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<WedgeVaultItem | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<WedgeVaultItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private manager: WedgeManager;
  private disposables: vscode.Disposable[] = [];

  constructor(manager: WedgeManager) {
    this.manager = manager;

    // Refresh tree when wedges change
    const wedgeChange = manager.onDidChange(() => {
      this.refresh();
    });

    this.disposables.push(wedgeChange);
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: WedgeVaultItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: WedgeVaultItem): WedgeVaultItem[] {
    if (!element) {
      // Root: group by file
      return this.getRootItems();
    }

    if (element.kind === 'file' && element.filePath) {
      return this.getWedgesForFile(element.filePath);
    }

    return [];
  }

  private getRootItems(): WedgeVaultItem[] {
    const byFile = this.manager.getByFile();

    if (byFile.size === 0) {
      return [];
    }

    return [...byFile.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([filePath, wedges]) =>
        new WedgeVaultItem('file', filePath, wedges.length)
      );
  }

  private getWedgesForFile(filePath: string): WedgeVaultItem[] {
    const wedges = this.manager.getForFile(filePath);
    return wedges
      .sort((a, b) => a.startLine - b.startLine)
      .map(wedge =>
        new WedgeVaultItem('wedge', filePath, wedges.length, wedge)
      );
  }

  public dispose(): void {
    this._onDidChangeTreeData.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

/**
 * Stats TreeDataProvider — shows summary info about wedge memory.
 */
export class WedgeStatsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private manager: WedgeManager;
  private ollamaAvailable = false;
  private disposables: vscode.Disposable[] = [];

  constructor(manager: WedgeManager) {
    this.manager = manager;

    const wedgeChange = manager.onDidChange(() => {
      this._onDidChangeTreeData.fire();
    });

    this.disposables.push(wedgeChange);
  }

  public setOllamaStatus(available: boolean): void {
    this.ollamaAvailable = available;
    this._onDidChangeTreeData.fire();
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(): vscode.TreeItem[] {
    const wedges = this.manager.getAll();
    const byFile = this.manager.getByFile();

    const items: vscode.TreeItem[] = [];

    const totalItem = new vscode.TreeItem(
      `Total Wedges: ${wedges.length}`,
      vscode.TreeItemCollapsibleState.None
    );
    totalItem.iconPath = new vscode.ThemeIcon('lock');
    items.push(totalItem);

    const filesItem = new vscode.TreeItem(
      `Protected Files: ${byFile.size}`,
      vscode.TreeItemCollapsibleState.None
    );
    filesItem.iconPath = new vscode.ThemeIcon('files');
    items.push(filesItem);

    const embeddingCount = wedges.filter(w => w.embedding && w.embedding.length > 0).length;
    const embeddingItem = new vscode.TreeItem(
      `Embedded: ${embeddingCount} / ${wedges.length}`,
      vscode.TreeItemCollapsibleState.None
    );
    embeddingItem.iconPath = new vscode.ThemeIcon('symbol-array');
    embeddingItem.tooltip = 'Wedges with semantic embeddings for similarity search';
    items.push(embeddingItem);

    const ollamaItem = new vscode.TreeItem(
      `Ollama: ${this.ollamaAvailable ? 'Connected' : 'Offline'}`,
      vscode.TreeItemCollapsibleState.None
    );
    ollamaItem.iconPath = new vscode.ThemeIcon(
      this.ollamaAvailable ? 'check' : 'warning'
    );
    ollamaItem.tooltip = this.ollamaAvailable
      ? 'Ollama is running — AI features enabled'
      : 'Ollama is not running — start it for AI features';
    items.push(ollamaItem);

    return items;
  }

  public dispose(): void {
    this._onDidChangeTreeData.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

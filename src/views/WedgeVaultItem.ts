import * as vscode from 'vscode';
import * as path from 'path';
import { Wedge } from '../wedge/types';

export type VaultItemKind = 'file' | 'wedge';

export class WedgeVaultItem extends vscode.TreeItem {
  public readonly kind: VaultItemKind;
  public readonly wedge?: Wedge;
  public readonly filePath?: string;

  constructor(
    kind: 'file',
    filePath: string,
    wedgeCount: number
  );
  constructor(
    kind: 'wedge',
    filePath: string,
    wedgeCount: number,
    wedge: Wedge
  );
  constructor(
    kind: VaultItemKind,
    filePath: string,
    wedgeCount: number,
    wedge?: Wedge
  ) {
    const label = kind === 'file'
      ? path.basename(filePath)
      : buildWedgeLabel(wedge!);

    const collapsible = kind === 'file'
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;

    super(label, collapsible);

    this.kind = kind;
    this.filePath = filePath;
    this.wedge = wedge;

    if (kind === 'file') {
      this.description = `${wedgeCount} wedge${wedgeCount !== 1 ? 's' : ''}`;
      this.iconPath = new vscode.ThemeIcon('file-code');
      this.tooltip = filePath;
      this.contextValue = 'wedge-file';
    } else if (wedge) {
      this.description = new Date(wedge.createdAt).toLocaleDateString();
      this.iconPath = new vscode.ThemeIcon('lock');
      this.tooltip = buildTooltip(wedge);
      this.contextValue = 'wedge-item';

      // Clicking a wedge navigates to its location
      this.command = {
        command: 'wedgeguard.revealWedge',
        title: 'Go to Wedge',
        arguments: [wedge],
      };
    }
  }
}

function buildWedgeLabel(wedge: Wedge): string {
  const firstLine = wedge.code.split('\n')[0].trim();
  const truncated = firstLine.length > 40
    ? firstLine.slice(0, 40) + '…'
    : firstLine;
  return truncated || `Wedge (line ${wedge.startLine + 1})`;
}

function buildTooltip(wedge: Wedge): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`🔒 **${escapeMarkdown(wedge.reason)}**\n\n`);
  md.appendMarkdown(`*Line ${wedge.startLine + 1}–${wedge.endLine + 1}*\n\n`);
  md.appendCodeblock(truncate(wedge.code, 300), wedge.language);
  return md;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[*_`[\]]/g, '\\$&');
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

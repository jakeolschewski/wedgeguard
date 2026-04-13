import * as vscode from 'vscode';
import { Wedge } from './types';
import { WedgeManager } from './WedgeManager';

export class WedgeDecorator {
  private decorationType: vscode.TextEditorDecorationType;
  private manager: WedgeManager;
  private disposables: vscode.Disposable[] = [];

  constructor(manager: WedgeManager) {
    this.manager = manager;

    this.decorationType = vscode.window.createTextEditorDecorationType({
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: new vscode.ThemeColor('charts.green'),
      backgroundColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
      isWholeLine: false,
      gutterIconPath: undefined,
      overviewRulerColor: new vscode.ThemeColor('charts.green'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      light: {
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.08)',
        overviewRulerColor: '#22c55e',
      },
      dark: {
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74,222,128,0.08)',
        overviewRulerColor: '#4ade80',
      },
    });

    // Re-decorate when active editor changes
    const editorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        this.decorateEditor(editor);
      }
    });

    // Re-decorate when wedges change
    const wedgeChange = manager.onDidChange(() => {
      for (const editor of vscode.window.visibleTextEditors) {
        this.decorateEditor(editor);
      }
    });

    this.disposables.push(editorChange, wedgeChange);

    // Initial decoration for already-open editors
    for (const editor of vscode.window.visibleTextEditors) {
      this.decorateEditor(editor);
    }
  }

  private decorateEditor(editor: vscode.TextEditor): void {
    const filePath = editor.document.uri.fsPath;
    const wedges = this.manager.getForFile(filePath);
    const decorations: vscode.DecorationOptions[] = wedges.map(wedge => {
      const startPos = new vscode.Position(wedge.startLine, wedge.startCharacter);
      const endPos = new vscode.Position(wedge.endLine, wedge.endCharacter);
      const range = new vscode.Range(startPos, endPos);
      return {
        range,
        hoverMessage: new vscode.MarkdownString(
          `🔒 **Wedged** — *${escapeMarkdown(wedge.reason)}*\n\n` +
          `*Created: ${new Date(wedge.createdAt).toLocaleString()}*\n\n` +
          `\`\`\`${wedge.language}\n${truncate(wedge.code, 200)}\n\`\`\``
        ),
      };
    });
    editor.setDecorations(this.decorationType, decorations);
  }

  public forceRefresh(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.decorateEditor(editor);
    }
  }

  public dispose(): void {
    this.decorationType.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[*_`[\]]/g, '\\$&');
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  return text.slice(0, maxLen) + '...';
}

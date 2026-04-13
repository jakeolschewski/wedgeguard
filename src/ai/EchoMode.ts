import * as vscode from 'vscode';
import { OllamaClient } from './OllamaClient';
import { WedgeManager } from '../wedge/WedgeManager';
import { WedgeMemory } from '../memory/WedgeMemory';
import { buildChatMessages } from './AgentPrompt';
import { getConfig } from '../utils/config';

const ECHO_TRIGGER = '// wedge:';
const ECHO_PROCESSED_MARKER = '// wedge:done:';
const DEBOUNCE_MS = 800;

export class EchoMode {
  private client: OllamaClient;
  private manager: WedgeManager;
  private memory: WedgeMemory;
  private outputChannel: vscode.OutputChannel;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private processingDocs = new Set<string>();
  private disposables: vscode.Disposable[] = [];

  constructor(
    client: OllamaClient,
    manager: WedgeManager,
    memory: WedgeMemory,
    outputChannel: vscode.OutputChannel
  ) {
    this.client = client;
    this.manager = manager;
    this.memory = memory;
    this.outputChannel = outputChannel;

    const changeListener = vscode.workspace.onDidChangeTextDocument(event => {
      this.onDocumentChange(event);
    });

    this.disposables.push(changeListener);
  }

  private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const doc = event.document;
    const docKey = doc.uri.toString();

    // Only trigger on actual content changes
    if (event.contentChanges.length === 0) {
      return;
    }

    // Debounce per document
    const existing = this.debounceTimers.get(docKey);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(docKey);
      this.checkForEchoTriggers(doc).catch(err => {
        this.outputChannel.appendLine(
          `[EchoMode] Error: ${err instanceof Error ? err.message : String(err)}`
        );
      });
    }, DEBOUNCE_MS);

    this.debounceTimers.set(docKey, timer);
  }

  private async checkForEchoTriggers(
    doc: vscode.TextDocument
  ): Promise<void> {
    const docKey = doc.uri.toString();

    // Prevent concurrent processing of the same document
    if (this.processingDocs.has(docKey)) {
      return;
    }

    const triggers: Array<{ line: number; prompt: string }> = [];

    for (let i = 0; i < doc.lineCount; i++) {
      const lineText = doc.lineAt(i).text;
      const trimmed = lineText.trimStart();

      // Look for unprocessed wedge: triggers
      if (
        trimmed.startsWith(ECHO_TRIGGER) &&
        !trimmed.startsWith(ECHO_PROCESSED_MARKER)
      ) {
        const prompt = trimmed.slice(ECHO_TRIGGER.length).trim();
        if (prompt.length > 0) {
          triggers.push({ line: i, prompt });
        }
      }
    }

    if (triggers.length === 0) {
      return;
    }

    const available = await this.client.isAvailable();
    if (!available) {
      vscode.window.showWarningMessage(
        'WedgeGuard Echo Mode: Ollama is not running. Start Ollama to use Echo Mode.'
      );
      return;
    }

    this.processingDocs.add(docKey);

    try {
      for (const trigger of triggers) {
        await this.processTrigger(doc, trigger.line, trigger.prompt);
      }
    } finally {
      this.processingDocs.delete(docKey);
    }
  }

  private async processTrigger(
    doc: vscode.TextDocument,
    lineNumber: number,
    prompt: string
  ): Promise<void> {
    const filePath = doc.uri.fsPath;
    const config = getConfig();

    this.outputChannel.appendLine(
      `[EchoMode] Processing trigger on line ${lineNumber + 1}: "${prompt}"`
    );

    // Get relevant wedges
    const allWedges = this.manager.getAll();
    const fileWedges = this.manager.getForFile(filePath);
    const relevantWedges = await this.memory.findRelevant(
      prompt,
      allWedges,
      config.maxWedgeContext
    );

    // Merge file wedges + relevant wedges (de-dup by id)
    const wedgeMap = new Map(
      [...fileWedges, ...relevantWedges].map(w => [w.id, w])
    );
    const activeWedges = [...wedgeMap.values()];

    const styleSnapshot = this.memory.buildStyleSnapshot(allWedges);
    const fileContent = doc.getText();
    const language = doc.languageId;

    const messages = buildChatMessages(
      { activeWedges, styleSnapshot, language, fileContent },
      `Generate code for the following request. Return ONLY the code (no explanation, no markdown fences unless asked). Request: ${prompt}`
    );

    let generatedCode = '';
    try {
      generatedCode = await this.client.chat(messages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[EchoMode] Ollama error: ${msg}`);
      vscode.window.showErrorMessage(`WedgeGuard Echo Mode error: ${msg}`);
      return;
    }

    // Strip markdown code fences if present
    generatedCode = stripCodeFences(generatedCode);

    // Apply edit: mark the trigger line as processed and insert generated code below it
    const editor = vscode.window.visibleTextEditors.find(
      e => e.document.uri.toString() === doc.uri.toString()
    );

    if (!editor) {
      this.outputChannel.appendLine(
        '[EchoMode] Could not find active editor for document'
      );
      return;
    }

    await editor.edit(editBuilder => {
      // Re-fetch the line to get current text (may have changed during async op)
      const currentLine = editor.document.lineAt(lineNumber);
      const currentText = currentLine.text;

      // Only proceed if the line still starts with // wedge:
      if (!currentText.trimStart().startsWith(ECHO_TRIGGER)) {
        return;
      }

      // Replace trigger comment with processed marker
      const indent = currentText.match(/^(\s*)/)?.[1] ?? '';
      const processedComment = `${indent}${ECHO_PROCESSED_MARKER} ${prompt}`;
      editBuilder.replace(currentLine.range, processedComment);

      // Insert generated code on the next line
      const insertPos = new vscode.Position(lineNumber + 1, 0);
      const indentedCode = generatedCode
        .split('\n')
        .map(l => (l.length > 0 ? indent + l : l))
        .join('\n');
      editBuilder.insert(insertPos, indentedCode + '\n');
    });

    this.outputChannel.appendLine(
      `[EchoMode] Inserted ${generatedCode.split('\n').length} lines of generated code`
    );
  }

  public dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function stripCodeFences(text: string): string {
  const fencePattern = /^```[\w]*\n([\s\S]*?)```$/m;
  const match = text.match(fencePattern);
  if (match) {
    return match[1].trimEnd();
  }
  // Also handle just opening fence without closing
  const openFence = /^```[\w]*\n([\s\S]*)$/m;
  const openMatch = text.match(openFence);
  if (openMatch) {
    return openMatch[1].trimEnd();
  }
  return text.trim();
}

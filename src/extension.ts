import * as vscode from 'vscode';
import * as path from 'path';
import { WedgeManager } from './wedge/WedgeManager';
import { WedgeDecorator } from './wedge/WedgeDecorator';
import { OllamaClient } from './ai/OllamaClient';
import { WedgeMemory } from './memory/WedgeMemory';
import { EchoMode } from './ai/EchoMode';
import { WedgeVaultProvider, WedgeStatsProvider } from './views/WedgeVaultProvider';
import { buildChatMessages } from './ai/AgentPrompt';
import { getConfig } from './utils/config';
import { Wedge } from './wedge/types';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // ── Core services ──────────────────────────────────────────────────────────

  const wedgeManager = new WedgeManager(context);
  const ollamaClient = new OllamaClient();
  const wedgeMemory = new WedgeMemory(ollamaClient);
  const wedgeDecorator = new WedgeDecorator(wedgeManager);

  const outputChannel = vscode.window.createOutputChannel('WedgeGuard');

  const echoMode = new EchoMode(ollamaClient, wedgeManager, wedgeMemory, outputChannel);

  // ── Sidebar views ──────────────────────────────────────────────────────────

  const vaultProvider = new WedgeVaultProvider(wedgeManager);
  const statsProvider = new WedgeStatsProvider(wedgeManager);

  const vaultView = vscode.window.createTreeView('wedgeguard.vault', {
    treeDataProvider: vaultProvider,
    showCollapseAll: true,
  });

  const statsView = vscode.window.createTreeView('wedgeguard.stats', {
    treeDataProvider: statsProvider,
  });

  // ── Status bar ─────────────────────────────────────────────────────────────

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'wedgeguard.showVault';
  statusBarItem.tooltip = 'WedgeGuard — click to open Wedge Vault';
  updateStatusBar(statusBarItem, wedgeManager.count());
  statusBarItem.show();

  // Update status bar when wedges change
  context.subscriptions.push(
    wedgeManager.onDidChange(() => {
      updateStatusBar(statusBarItem, wedgeManager.count());
    })
  );

  // ── Commands ───────────────────────────────────────────────────────────────

  // wedgeguard.createWedge
  const createWedgeCmd = vscode.commands.registerCommand(
    'wedgeguard.createWedge',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('WedgeGuard: No active editor.');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage(
          'WedgeGuard: Select code to wedge first.'
        );
        return;
      }

      const selectedText = editor.document.getText(selection);

      const reason = await vscode.window.showInputBox({
        prompt: 'Why are you locking this code? (e.g. "core auth logic — never change")',
        placeHolder: 'Describe why this code is sacred...',
        validateInput: (v) =>
          v.trim().length === 0 ? 'Reason cannot be empty' : null,
      });

      if (!reason) {
        return; // User cancelled
      }

      const filePath = editor.document.uri.fsPath;
      const language = editor.document.languageId;

      const wedge = wedgeManager.create({
        code: selectedText,
        reason: reason.trim(),
        filePath,
        startLine: selection.start.line,
        startCharacter: selection.start.character,
        endLine: selection.end.line,
        endCharacter: selection.end.character,
        language,
      });

      // Attempt to generate embedding in the background
      generateEmbeddingAsync(ollamaClient, wedgeManager, wedge).catch(() => {
        // Silently ignore embedding failures
      });

      vscode.window.showInformationMessage(
        `🔒 Wedge created: "${reason.slice(0, 50)}${reason.length > 50 ? '...' : ''}"`
      );
      outputChannel.appendLine(
        `[WedgeGuard] Created wedge "${wedge.id}" at ${path.basename(filePath)}:${selection.start.line + 1}`
      );
    }
  );

  // wedgeguard.removeWedge
  const removeWedgeCmd = vscode.commands.registerCommand(
    'wedgeguard.removeWedge',
    async () => {
      const allWedges = wedgeManager.getAll();
      if (allWedges.length === 0) {
        vscode.window.showInformationMessage('WedgeGuard: No wedges to remove.');
        return;
      }

      const items = allWedges.map((w) => ({
        label: `$(lock) ${w.reason.slice(0, 50)}`,
        description: `${path.basename(w.filePath)}:${w.startLine + 1}`,
        detail: w.code.split('\n')[0].trim().slice(0, 80),
        id: w.id,
      }));

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a wedge to remove',
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!picked) {
        return;
      }

      wedgeManager.remove(picked.id);
      vscode.window.showInformationMessage('WedgeGuard: Wedge removed.');
    }
  );

  // wedgeguard.clearAllWedges
  const clearAllCmd = vscode.commands.registerCommand(
    'wedgeguard.clearAllWedges',
    async () => {
      const count = wedgeManager.count();
      if (count === 0) {
        vscode.window.showInformationMessage('WedgeGuard: No wedges to clear.');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `WedgeGuard: This will permanently remove all ${count} wedge${count !== 1 ? 's' : ''}. Are you sure?`,
        { modal: true },
        'Clear All'
      );

      if (confirm === 'Clear All') {
        wedgeManager.clearAll();
        vscode.window.showInformationMessage('WedgeGuard: All wedges cleared.');
      }
    }
  );

  // wedgeguard.askAI
  const askAICmd = vscode.commands.registerCommand(
    'wedgeguard.askAI',
    async () => {
      const editor = vscode.window.activeTextEditor;
      const filePath = editor?.document.uri.fsPath;

      const available = await ollamaClient.isAvailable();
      if (!available) {
        const action = await vscode.window.showErrorMessage(
          'WedgeGuard: Ollama is not running. Start Ollama to use AI features.',
          'Open Ollama Docs'
        );
        if (action === 'Open Ollama Docs') {
          vscode.env.openExternal(vscode.Uri.parse('https://ollama.ai'));
        }
        return;
      }

      const prompt = await vscode.window.showInputBox({
        prompt: 'Ask WedgeGuard AI (your wedges will be injected as context)',
        placeHolder: 'e.g. "Add error handling to the API call below my auth wedge"',
      });

      if (!prompt) {
        return;
      }

      outputChannel.show(true);
      outputChannel.appendLine('\n' + '='.repeat(60));
      outputChannel.appendLine(`[WedgeGuard AI] Query: ${prompt}`);
      outputChannel.appendLine('='.repeat(60));

      const allWedges = wedgeManager.getAll();
      const fileWedges = filePath ? wedgeManager.getForFile(filePath) : [];
      const config = getConfig();
      const relevantWedges = await wedgeMemory.findRelevant(
        prompt,
        allWedges,
        config.maxWedgeContext
      );

      // Merge: file wedges + relevant wedges
      const wedgeMap = new Map(
        [...fileWedges, ...relevantWedges].map((w) => [w.id, w])
      );
      const activeWedges = [...wedgeMap.values()];

      const styleSnapshot = wedgeMemory.buildStyleSnapshot(allWedges);
      const fileContent = editor?.document.getText();
      const language = editor?.document.languageId;

      outputChannel.appendLine(
        `[WedgeGuard AI] Using ${activeWedges.length} wedge(s) as context...`
      );

      const messages = buildChatMessages(
        { activeWedges, styleSnapshot, language, fileContent },
        prompt
      );

      try {
        outputChannel.appendLine('\n[WedgeGuard AI] Response:\n');
        const response = await ollamaClient.chatStream(messages, (chunk) => {
          outputChannel.append(chunk);
        });
        outputChannel.appendLine('\n');

        if (!response) {
          outputChannel.appendLine('[WedgeGuard AI] No response received.');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`\n[WedgeGuard AI] Error: ${msg}`);
        vscode.window.showErrorMessage(`WedgeGuard AI error: ${msg}`);
      }
    }
  );

  // wedgeguard.showVault
  const showVaultCmd = vscode.commands.registerCommand(
    'wedgeguard.showVault',
    () => {
      vscode.commands.executeCommand('wedgeguard.vault.focus');
    }
  );

  // wedgeguard.revealWedge (internal — called by tree item click)
  const revealWedgeCmd = vscode.commands.registerCommand(
    'wedgeguard.revealWedge',
    async (wedge: Wedge) => {
      try {
        const uri = vscode.Uri.file(wedge.filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);
        const startPos = new vscode.Position(wedge.startLine, wedge.startCharacter);
        const endPos = new vscode.Position(wedge.endLine, wedge.endCharacter);
        const range = new vscode.Range(startPos, endPos);
        editor.selection = new vscode.Selection(startPos, endPos);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`WedgeGuard: Could not open file: ${msg}`);
      }
    }
  );

  // wedgeguard.exportWedges
  const exportCmd = vscode.commands.registerCommand(
    'wedgeguard.exportWedges',
    async () => {
      const count = wedgeManager.count();
      if (count === 0) {
        vscode.window.showInformationMessage('WedgeGuard: No wedges to export.');
        return;
      }

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('wedges.json'),
        filters: { 'WedgeGuard Export': ['json'] },
        saveLabel: 'Export Wedges',
      });

      if (!uri) {
        return;
      }

      try {
        wedgeManager.exportToFile(uri.fsPath);
        vscode.window.showInformationMessage(
          `WedgeGuard: Exported ${count} wedge${count !== 1 ? 's' : ''} to ${path.basename(uri.fsPath)}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`WedgeGuard export error: ${msg}`);
      }
    }
  );

  // wedgeguard.importWedges
  const importCmd = vscode.commands.registerCommand(
    'wedgeguard.importWedges',
    async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'WedgeGuard Export': ['json'] },
        openLabel: 'Import Wedges',
      });

      if (!uris || uris.length === 0) {
        return;
      }

      try {
        const added = wedgeManager.importFromFile(uris[0].fsPath);
        vscode.window.showInformationMessage(
          `WedgeGuard: Imported ${added} new wedge${added !== 1 ? 's' : ''}.`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`WedgeGuard import error: ${msg}`);
      }
    }
  );

  // ── Event Listeners ────────────────────────────────────────────────────────

  // Refresh decorations when active editor changes
  const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(
    () => wedgeDecorator.forceRefresh()
  );

  // ── Register all disposables ───────────────────────────────────────────────

  context.subscriptions.push(
    wedgeManager,
    wedgeDecorator,
    echoMode,
    vaultProvider,
    statsProvider,
    vaultView,
    statsView,
    outputChannel,
    statusBarItem,
    createWedgeCmd,
    removeWedgeCmd,
    clearAllCmd,
    askAICmd,
    showVaultCmd,
    revealWedgeCmd,
    exportCmd,
    importCmd,
    editorChangeListener
  );

  // ── Startup checks ─────────────────────────────────────────────────────────

  outputChannel.appendLine('[WedgeGuard] Extension activated.');
  outputChannel.appendLine(
    `[WedgeGuard] Loaded ${wedgeManager.count()} wedge(s) from storage.`
  );

  // Check Ollama in background — don't block activation
  ollamaClient.isAvailable().then((available) => {
    statsProvider.setOllamaStatus(available);
    if (!available) {
      outputChannel.appendLine(
        '[WedgeGuard] Ollama not detected. AI features will be unavailable until Ollama is running.'
      );
      vscode.window
        .showInformationMessage(
          'WedgeGuard: Ollama is not running. Start Ollama for AI features (wedge protection works without it).',
          'Get Ollama'
        )
        .then((action) => {
          if (action === 'Get Ollama') {
            vscode.env.openExternal(vscode.Uri.parse('https://ollama.ai'));
          }
        });
    } else {
      outputChannel.appendLine('[WedgeGuard] Ollama connected.');
      const config = getConfig();
      outputChannel.appendLine(`[WedgeGuard] Model: ${config.model}`);
    }
  });
}

export function deactivate(): void {
  // Disposables registered via context.subscriptions are cleaned up automatically.
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function updateStatusBar(item: vscode.StatusBarItem, count: number): void {
  item.text = `$(lock) ${count} Wedge${count !== 1 ? 's' : ''}`;
}

async function generateEmbeddingAsync(
  client: OllamaClient,
  manager: WedgeManager,
  wedge: Wedge
): Promise<void> {
  const available = await client.isAvailable();
  if (!available) {
    return;
  }
  const embedding = await client.embed(`${wedge.reason}\n${wedge.code}`);
  if (embedding.length > 0) {
    manager.updateEmbedding(wedge.id, embedding);
  }
}

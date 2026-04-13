import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WedgeStore } from '../wedge/types';

const STORE_FILE = 'wedge-store.json';
const CURRENT_VERSION = 1;

function getStorePath(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, STORE_FILE);
}

function ensureStorageDir(context: vscode.ExtensionContext): void {
  const dir = context.globalStorageUri.fsPath;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadStore(context: vscode.ExtensionContext): WedgeStore {
  ensureStorageDir(context);
  const storePath = getStorePath(context);
  if (!fs.existsSync(storePath)) {
    return { version: CURRENT_VERSION, wedges: [] };
  }
  try {
    const raw = fs.readFileSync(storePath, 'utf-8');
    const parsed = JSON.parse(raw) as WedgeStore;
    if (typeof parsed.version !== 'number' || !Array.isArray(parsed.wedges)) {
      return { version: CURRENT_VERSION, wedges: [] };
    }
    return parsed;
  } catch {
    return { version: CURRENT_VERSION, wedges: [] };
  }
}

export function saveStore(context: vscode.ExtensionContext, store: WedgeStore): void {
  ensureStorageDir(context);
  const storePath = getStorePath(context);
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
}

export function loadStoreFromFile(filePath: string): WedgeStore | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as WedgeStore;
    if (typeof parsed.version !== 'number' || !Array.isArray(parsed.wedges)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoreToFile(filePath: string, store: WedgeStore): void {
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

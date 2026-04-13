<p align="center">
  <img src="media/icon.svg" width="120" alt="WedgeGuard Logo">
</p>

<h1 align="center">WedgeGuard</h1>

<p align="center">
  <strong>The first VS Code extension that makes AI respect your code.</strong>
</p>

<p align="center">
  Lock critical code with Wedges. Generate new code with AI. Never lose your intent.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=wedgemethod.wedgeguard"><img src="https://img.shields.io/badge/VS%20Code-Marketplace-007ACC?logo=visualstudiocode&logoColor=white" alt="VS Code Marketplace"></a>
  <a href="https://github.com/jakeolschewski/wedgeguard/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT"></a>
  <a href="https://github.com/jakeolschewski/wedgeguard/stargazers"><img src="https://img.shields.io/github/stars/jakeolschewski/wedgeguard?style=social" alt="Stars"></a>
  <img src="https://img.shields.io/badge/AI-Local%20Only-28a745" alt="Local AI">
  <img src="https://img.shields.io/badge/Dependencies-Zero-blue" alt="Zero Dependencies">
</p>

---

## The Problem

AI coding tools are powerful, but they have a fatal flaw: **they don't know which code they shouldn't touch.**

Every developer has experienced it:
- AI rewrites your carefully tuned auth logic
- Copilot suggests changes that break your validated business rules
- Generated code overwrites security-critical functions
- You spend more time undoing AI mistakes than writing code

**WedgeGuard solves this forever.**

## How It Works

WedgeGuard introduces **Wedges** — immutable code anchors that AI can never modify.

```
┌─────────────────────────────────────────┐
│  Your Code                              │
│                                         │
│  function processPayment(amount) {      │
│ ┌─── 🔒 WEDGE: "Core payment logic" ──┐│
│ │  if (amount <= 0) throw new Error();  ││
│ │  const fee = amount * 0.029 + 0.30;  ││
│ │  return stripe.charge(amount + fee);  ││
│ └───────────────────────────────────────┘│
│                                         │
│  // AI can freely edit here             │
│  function formatReceipt(payment) {      │
│    ...                                  │
│  }                                      │
└─────────────────────────────────────────┘
```

1. **Select** any code block
2. **Wedge** it with a reason ("Core payment logic — do not modify")
3. **Code with AI** — WedgeGuard injects all wedge context into every prompt
4. **AI respects your boundaries** — locked code is preserved exactly

## Features

### Wedge System
- **Create Wedges** — Select code, give a reason, it's locked forever
- **Visual Indicators** — Green highlights, gutter icons, hover tooltips
- **Edit Protection** — Changes to wedged code are auto-reverted with a warning
- **Line Tracking** — Wedge positions auto-adjust when surrounding code changes
- **Export/Import** — Share wedge sets across your team as JSON files

### Wedge Memory (Local RAG)
- **Vector Storage** — Every wedge is embedded and indexed locally
- **Cosine Similarity Search** — Find relevant wedges by semantic meaning
- **Zero Dependencies** — Pure TypeScript math, no native modules
- **Persistent** — Memory survives across VS Code sessions
- **Bounded** — Auto-manages memory to prevent unbounded growth

### AI Agent (Ollama)
- **Wedge-Aware Prompts** — Every AI interaction includes locked code context
- **Conversation History** — Multi-turn conversations with memory
- **Context Injection** — Current file, relevant memory, and all wedges
- **Local Only** — Runs on Ollama, your data never leaves your machine
- **Any Model** — Works with Qwen, Llama, Mistral, CodeGemma, DeepSeek, etc.

### Echo Mode
- **Inline Generation** — Type `// wedge: your prompt` and press Enter
- **Multi-Language** — Works with `//`, `#`, `--`, `/* */`, `<!-- -->`, `%` comments
- **Wedge-Aware** — Generated code never conflicts with locked regions
- **Context-Rich** — Uses surrounding code + memory for better results

### Wedge Vault (Sidebar)
- **File-Organized View** — All wedges grouped by file in the activity bar
- **Click to Navigate** — Jump to any wedge instantly
- **Memory Stats** — Monitor memory entries, indexed wedges, Ollama status
- **Quick Actions** — Remove, export, or search wedges from the sidebar

## Quick Start

### 1. Install Ollama (Free, Local)

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download
```

### 2. Pull a Model

```bash
ollama pull qwen2.5-coder:7b     # Recommended for code generation
ollama pull nomic-embed-text       # Required for memory/search
```

### 3. Install WedgeGuard

Search "WedgeGuard" in the VS Code extensions marketplace, or:

```bash
code --install-extension wedgemethod.wedgeguard
```

### 4. Create Your First Wedge

1. Open any file
2. Select a code block you want to protect
3. Press `Ctrl+Shift+P` → "WedgeGuard: Create Wedge"
4. Enter a reason (e.g., "Auth validation — do not modify")
5. Done. That code is now permanently protected.

### 5. Use Echo Mode

```javascript
// wedge: add input validation for email and password
```

Press Enter after typing the comment. WedgeGuard generates the code inline.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `wedgeguard.ollamaUrl` | `http://localhost:11434` | Ollama server URL |
| `wedgeguard.model` | `qwen2.5-coder:7b` | Chat/generation model |
| `wedgeguard.embeddingModel` | `nomic-embed-text` | Embedding model for memory |
| `wedgeguard.maxWedgeContext` | `10` | Max wedges in AI context |

## Architecture

```
WedgeGuard
├── Extension Host (VS Code)
│   ├── WedgeManager          # Create, store, enforce wedges
│   ├── WedgeMemory            # Local vector store + cosine similarity
│   ├── WedgeAgent             # Ollama AI with wedge-aware prompting
│   ├── EchoMode               # Inline code generation (// wedge:)
│   └── WedgeVault             # Sidebar TreeView UI
│
├── Storage (Local JSON)
│   ├── wedge-store.json       # All wedges with positions + code
│   └── wedge-memory.json      # Vector embeddings + metadata
│
└── Ollama (Local)
    ├── Chat API               # Code generation + Q&A
    └── Embeddings API         # Text → vector for memory
```

**Design Principles:**
- **Zero runtime npm dependencies** — Only VS Code API + Node.js builtins
- **No native modules** — Pure TypeScript everywhere (no Rust, no C++)
- **No cloud calls** — Everything runs on your machine via Ollama
- **Graceful degradation** — Works without Ollama (wedge system still functions)
- **Instant activation** — No heavy initialization, no waiting

## Why WedgeGuard?

| Feature | GitHub Copilot | Cursor | Cody | **WedgeGuard** |
|---------|:---:|:---:|:---:|:---:|
| Code locking | ❌ | ❌ | ❌ | ✅ |
| Edit protection | ❌ | ❌ | ❌ | ✅ |
| Local AI only | ❌ | ❌ | ❌ | ✅ |
| Zero dependencies | ❌ | ❌ | ❌ | ✅ |
| Inline generation | ✅ | ✅ | ✅ | ✅ |
| Wedge-aware context | ❌ | ❌ | ❌ | ✅ |
| Memory/RAG | ❌ | Partial | Partial | ✅ |
| Free forever | ❌ | ❌ | Partial | ✅ |
| Privacy | Cloud | Cloud | Cloud | **100% Local** |

## Use Cases

**Solo Developers**: Protect your core business logic while using AI to speed up everything else.

**Security Engineers**: Lock down auth, encryption, and validation code. AI can never accidentally weaken your security posture.

**Team Leads**: Export wedge sets as team standards. New developers can't accidentally break critical paths.

**Open Source Maintainers**: Wedge your public API surfaces. Contributors can add features without breaking compatibility.

**Consultants**: Lock client-specific integrations. Use AI to build new features without risking existing work.

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
git clone https://github.com/jakeolschewski/wedgeguard.git
cd wedgeguard
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

## License

[MIT](LICENSE) — Copyright 2026 WEDGE Method LLC

## Built By

**[WEDGE Method LLC](https://thewedgemethodai.com)** — AI tools for consultants and developers who refuse to compromise.

Also check out:
- [consultant-ai](https://github.com/jakeolschewski/consultant-ai) — MCP server with 10 AI consulting tools
- [awesome-solopreneur-ai](https://github.com/jakeolschewski/awesome-solopreneur-ai) — 367+ curated AI tools for solo founders
- [business-prompts](https://github.com/jakeolschewski/business-prompts) — 94 production-ready business prompts

---

<p align="center">
  <strong>Your code. Your rules. AI that listens.</strong>
</p>

# Changelog

All notable changes to WedgeGuard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-01

### Added
- **Wedge Creation**: Highlight any code selection and lock it as a Wedge with a custom reason
- **Wedge Vault**: Sidebar TreeView showing all active wedges organized by file
- **Wedge Decorations**: Visual green border highlighting for wedged code in the editor
- **Echo Mode**: Type `// wedge:` followed by a prompt to trigger inline AI code generation
- **AI Assistant**: `WedgeGuard: Ask AI` command that builds context from all active wedges
- **Wedge Memory**: Local JSON-based storage with cosine similarity search for relevant wedge retrieval
- **Ollama Integration**: Chat and embedding support via local Ollama server (no cloud, no API keys)
- **Export/Import**: Save and load wedge sets as JSON files for project sharing
- **Status Bar**: Live wedge count indicator in the status bar
- **Graceful Degradation**: Extension works fully even when Ollama is not running

### Configuration
- `wedgeguard.ollamaUrl`: Ollama server URL (default: `http://localhost:11434`)
- `wedgeguard.model`: Chat model (default: `qwen2.5-coder:7b`)
- `wedgeguard.embeddingModel`: Embedding model (default: `nomic-embed-text`)
- `wedgeguard.maxWedgeContext`: Maximum wedges injected into AI context (default: `10`)

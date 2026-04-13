# Contributing to WedgeGuard

Thank you for your interest in contributing to WedgeGuard. This guide will help you get started.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jakeolschewski/wedgeguard.git
   cd wedgeguard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Compile:**
   ```bash
   npm run compile
   ```

4. **Run in development mode:**
   - Open the project in VS Code
   - Press `F5` to launch the Extension Development Host
   - Test your changes in the new VS Code window

## Project Structure

```
src/
├── extension.ts        # Entry point — activation, command registration
├── wedge/
│   ├── types.ts        # TypeScript interfaces
│   └── manager.ts      # Wedge CRUD, decorations, edit protection
├── memory/
│   └── engine.ts       # Vector storage, cosine similarity, embeddings
├── ai/
│   └── agent.ts        # Ollama integration, wedge-aware prompting
├── echo/
│   └── mode.ts         # Inline code generation (// wedge: prompt)
├── views/
│   └── vault.ts        # Sidebar TreeView providers
└── utils/
    ├── config.ts       # Settings reader
    └── storage.ts      # JSON file I/O
```

## Guidelines

### Code Style
- TypeScript strict mode
- No runtime npm dependencies (VS Code API + Node.js only)
- No native modules (must run in any VS Code extension host)
- Use `async/await` over `.then()` chains
- Document public methods with JSDoc

### Testing
- Compile with zero errors: `npx tsc -p ./`
- Test in Extension Development Host (F5)
- Verify Ollama integration with `ollama serve` running locally

### Pull Requests
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Ensure `npx tsc -p ./` compiles with zero errors
5. Open a pull request with a clear description

### What We're Looking For
- Bug fixes
- New comment syntax support for Echo Mode
- Performance improvements to cosine similarity search
- Additional TreeView features in the Vault
- Accessibility improvements
- Documentation improvements

## Architecture Decisions

- **No external vector databases** — They require native modules that don't work in VS Code extension hosts. We use JSON + cosine similarity instead.
- **No cloud APIs** — Everything runs via local Ollama. Privacy is non-negotiable.
- **Zero runtime deps** — Keeps the extension lightweight and compatible everywhere.
- **Graceful degradation** — The wedge system works fully even without Ollama running.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

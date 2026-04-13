import { Wedge } from '../wedge/types';
import { OllamaChatMessage } from '../wedge/types';

export interface PromptContext {
  /** Wedges relevant to the current file or query */
  activeWedges: Wedge[];
  /** Style summary from WedgeMemory */
  styleSnapshot: string;
  /** Current file's language identifier */
  language?: string;
  /** Current file content (optional, for Echo Mode) */
  fileContent?: string;
}

/**
 * Builds the system prompt for WedgeGuard AI.
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  const wedgeSection = buildWedgeSection(ctx.activeWedges);
  const styleSection = ctx.styleSnapshot
    ? `\n## USER'S CODING STYLE (from Wedge Memory):\n${ctx.styleSnapshot}`
    : '';

  return `You are WedgeGuard AI, a coding assistant that ALWAYS respects the user's Wedges.

## WEDGE RULES (ABSOLUTE — NEVER VIOLATE):
1. Code marked as a Wedge is SACRED. Never modify, overwrite, or remove it.
2. If your suggestion would conflict with a Wedge, say "⚠️ Wedge conflict" and offer an alternative that works AROUND the wedged code.
3. Build AROUND wedges, not through them.
4. When generating code, always leave wedged sections intact and generate complementary code only.
5. If you reference wedged code in your response, quote it exactly as given.
${wedgeSection}${styleSection}

Now help the user with their request. Be concise and practical. When generating code, output only the code block unless explanation is needed.`;
}

function buildWedgeSection(wedges: Wedge[]): string {
  if (wedges.length === 0) {
    return '\n## ACTIVE WEDGES:\nNo wedges active for the current context.';
  }

  const blocks = wedges
    .map((w, i) => {
      const loc = `${shortenPath(w.filePath)}:${w.startLine + 1}-${w.endLine + 1}`;
      return [
        `### Wedge ${i + 1} [${loc}]`,
        `**Reason:** ${w.reason}`,
        `\`\`\`${w.language}\n${w.code}\n\`\`\``,
      ].join('\n');
    })
    .join('\n\n');

  return `\n## ACTIVE WEDGES IN THIS CONTEXT (DO NOT MODIFY):\n${blocks}`;
}

/**
 * Builds a messages array for a user AI query.
 */
export function buildChatMessages(
  ctx: PromptContext,
  userQuery: string
): OllamaChatMessage[] {
  const messages: OllamaChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(ctx) },
  ];

  if (ctx.fileContent) {
    const lang = ctx.language ?? '';
    messages.push({
      role: 'user',
      content: `Here is the current file content for context:\n\`\`\`${lang}\n${ctx.fileContent}\n\`\`\``,
    });
    messages.push({
      role: 'assistant',
      content: "I've reviewed the file. I'll keep all wedged sections intact. What do you need?",
    });
  }

  messages.push({ role: 'user', content: userQuery });
  return messages;
}

function shortenPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  if (parts.length <= 3) {
    return filePath;
  }
  return '...' + '/' + parts.slice(-2).join('/');
}

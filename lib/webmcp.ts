export function registerLookup(action: (word: string) => Promise<unknown>) {
  const context = (
    document as unknown as {
      modelContext?: {
        registerTool: (tool: unknown, options: unknown) => unknown;
      };
    }
  ).modelContext;

  if (!context) return () => {};
  const lifecycle = new AbortController();

  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: 'check_czech_noun',
          title: 'Ověřit české podstatné jméno',
          description:
            'Look up a Czech noun in the Internet Language Reference Book, display its declension, and save it to the signed-in user’s dictionary.',
          inputSchema: {
            type: 'object',
            properties: {
              word: { type: 'string', minLength: 1, maxLength: 80 },
            },
            required: ['word'],
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: false,
            untrustedContentHint: true,
          },
          execute: async (input: unknown) => {
            const word = (input as { word?: unknown })?.word;
            if (typeof word !== 'string' || !word.trim() || word.length > 80) {
              throw new Error('Invalid word');
            }
            return action(word);
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
  } catch {
    // WebMCP is optional and not supported by every browser.
  }

  return () => lifecycle.abort();
}

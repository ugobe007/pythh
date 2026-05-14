/**
 * LLM bridge — in production this calls the Manus / Forge API.
 * Tests mock this module; local dev without keys throws a clear error.
 */

export type LLMCompletionMessage = { content?: string | null };
export type LLMCompletionChoice = { message?: LLMCompletionMessage };
export type LLMCompletionResponse = { choices?: LLMCompletionChoice[] };

export async function invokeLLM(_opts: unknown): Promise<LLMCompletionResponse> {
  throw new Error(
    "[invokeLLM] Not configured. Set BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY, or run with mocked LLM in tests.",
  );
}

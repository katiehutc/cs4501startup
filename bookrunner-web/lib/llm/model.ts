// One place for the model, so the app and the eval can't drift apart.
export const CLAUDE_MODEL = "claude-sonnet-4-6";

// Fail fast when Claude is slow or down, so the page shows "try again" instead of spinning.
export const LLM_TIMEOUT_MS = 20_000;
export const LLM_MAX_RETRIES = 1;

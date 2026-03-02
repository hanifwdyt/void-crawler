// ============================================================
// VOID CRAWLER - AI Configuration
// OpenRouter API settings. This file can be gitignored.
// ============================================================

const AI_CONFIG = {
  apiKey: '',  // Your OpenRouter API key here
  model: 'meta-llama/llama-3.1-8b-instruct',
  baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
  maxTokens: 150,
  chronicleMaxTokens: 300,
  bossMaxTokens: 100,
  temperature: 0.9,
};

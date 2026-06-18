import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-console': 'off',
      // Catch-block error variables are consistently unused in this codebase
      // (generic 500 responses are sent, not the error message itself)
      'no-unused-vars': ['error', { caughtErrors: 'none', argsIgnorePattern: '^_' }],
    },
  },
  { ignores: ['node_modules/', 'tests/'] },
];

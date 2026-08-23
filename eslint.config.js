'use strict';

/**
 * Плоская конфигурация ESLint 9+. Без плагинов и пресетов — только встроенные правила,
 * чтобы утилита оставалась без runtime-зависимостей, а lint не тянул половину npm.
 */
module.exports = [
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URL: 'readonly',
        TextEncoder: 'readonly',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-implicit-coercion': ['error', { boolean: false }],
      'no-throw-literal': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'multi-line'],
      'no-console': 'error',
      strict: ['error', 'global'],
    },
  },
];

import js from '@eslint/js';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        $: 'readonly',
        jQuery: 'readonly'
      }
    },
    rules: {
      ...js.configs.recommended.rules
    }
  },
  prettierConfig
];

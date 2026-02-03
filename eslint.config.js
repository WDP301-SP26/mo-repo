/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      'react/display-name': 'off',
      'import/namespace': 'off',
      'import/no-duplicates': 'off',
      'react/no-unescaped-entities': 'off',
      'import/no-unresolved': [
        'off',
        {
          ignore: ['^@env$'],
        },
      ],
    },
  },
]);

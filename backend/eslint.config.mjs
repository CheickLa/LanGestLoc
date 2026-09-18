// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Les paramètres préfixés d'un `_` sont volontairement inutilisés
      // (ex: `@Body() _dto` requis pour la validation et la doc Swagger).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      // Faux positif connu avec Jest : `expect(mock.methode)` passe la méthode
      // sans son `this`, ce qui est le comportement attendu ici.
      '@typescript-eslint/unbound-method': 'off',
      // Les matchers de @types/jest (objectContaining, any, stringContaining…)
      // sont déclarés comme renvoyant `any`.
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
);

import js from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import neostandard from "neostandard";
import tsEslint from "typescript-eslint";
import tsEslintParser from "@typescript-eslint/parser";
import globals from "globals";
import agamaI18nEslintPlugin from "eslint-plugin-agama-i18n";
import i18nextEslintPlugin from "eslint-plugin-i18next";
import tsEslintPlugin from "@typescript-eslint/eslint-plugin";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const neostandardConfig = neostandard({ semi: true, noStyle: true });

export default [
  ...neostandardConfig,
  js.configs.recommended,
  ...tsEslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      ecmaVersion: 7,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        ...globals.jest,
        ...globals.node,
        msCrypto: true,
      },
      parser: tsEslintParser,
    },
  },
  {
    plugins: {
      "agama-i18n": agamaI18nEslintPlugin,
      i18next: i18nextEslintPlugin,
      "typescript-eslint": tsEslintPlugin,
      "react-hooks": reactHooksPlugin,
    },
  },
  {
    rules: {
      "agama-i18n/string-literals": "error",
      "i18next/no-literal-string": "error",
      "no-var": "error",
      "no-multi-str": "off",
      "no-use-before-define": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-use-before-define": "warn",
      "@typescript-eslint/ban-ts-comment": "off",
      "lines-between-class-members": [
        "error",
        "always",
        {
          exceptAfterSingleLine: true,
        },
      ],
      "prefer-promise-reject-errors": [
        "error",
        {
          allowEmptyReject: true,
        },
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      camelcase: "off",
      "comma-dangle": "off",
      curly: "off",
      "jsx-quotes": "off",
      "key-spacing": "off",
      "no-console": "off",
      quotes: "off",
      "react/jsx-curly-spacing": "off",
      "react/jsx-indent-props": "off",
      "react/prop-types": "off",
      "space-before-function-paren": "off",
      "n/no-callback-literal": "off",
    },
  },
  {
    files: ["**/*.test.*", "src/test-utils.js"],
    rules: { "i18next/no-literal-string": "off" },
  },
  {
    files: ["src/i18n.test.js"],
    rules: { "agama-i18n/string-literals": "off" },
  },
  {
    // the translation JS files generated from the PO files use some code in the plural form rule,
    // ignore the possible "problems" there (using "==" operator instead of more strict "===" or not
    // using the "n" variable in languages which do not have plural form)
    files: ["src/po/*.js"],
    rules: { eqeqeq: "off", "@typescript-eslint/no-unused-vars": "off" },
  },
  {
    ignores: ["node_modules/*", "src/lib/*", "src/**/test-data/*"],
  },
];

module.exports = {
  env: {
    browser: true,
    es2022: true,
  },
  globals: {
    chrome: "readonly",
    Chart: "readonly",
  },
  extends: ["eslint:recommended"],
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: ["**/*.ts"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      plugins: ["@typescript-eslint"],
      extends: ["plugin:@typescript-eslint/recommended"],
      rules: {
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
        ],
      },
    },
    {
      files: ["**/*.js"],
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  ],
  ignorePatterns: [
    "dist/**",
    "public/chart.umd.min.js",
    "public/icons/**",
    "public/_locales/**",
    "docs/**",
    "icons/**",
    "_locales/**",
    ".agent/**",
  ],
};

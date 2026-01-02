module.exports = {
  env: {
    browser: true,
    es2022: true,
  },
  globals: {
    chrome: "readonly",
    Chart: "readonly",
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  extends: ["eslint:recommended"],
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
  ignorePatterns: ["chart.umd.min.js", "docs/**", "icons/**", "_locales/**", ".agent/**"],
};

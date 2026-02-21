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

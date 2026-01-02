module.exports = {
  extends: ["stylelint-config-standard"],
  rules: {
    "color-hex-length": null,
    "color-function-notation": null,
    "alpha-value-notation": null,
    "font-family-name-quotes": null,
    "custom-property-empty-line-before": null,
    "shorthand-property-no-redundant-values": null,
  },
  ignoreFiles: ["docs/**", "icons/**", "_locales/**", ".agent/**"],
};

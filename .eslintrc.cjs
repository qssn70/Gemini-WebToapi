module.exports = {
  env: {
    node: true,
    jest: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
  },
  extends: ["eslint:recommended"],
  rules: {
    "no-unused-vars": ["error", { ignoreRestSiblings: true }],
  },
  overrides: [
    {
      files: ["ui/**/*.js"],
      env: {
        browser: true,
      },
      rules: {
        "no-undef": "off",
        "no-useless-escape": "off",
      },
    },
    {
      files: ["src/browser/GeminiPageController.js"],
      rules: {
        "no-empty": "off",
      },
    },
  ],
};

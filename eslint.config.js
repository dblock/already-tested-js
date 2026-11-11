import js from "@eslint/js";
import markdown from "@eslint/markdown";

export default [
  { ignores: ["coverage/**", "dist/**"] },
  {
    ...js.configs.recommended,
    files: ["**/*.js"],
  },
  {
    files: ["*.md"],
    plugins: { markdown },
    processor: "markdown/markdown",
  },
  {
    files: ["**/*.md/*.js"],
    rules: { "no-unused-vars": "off" },
  },
];

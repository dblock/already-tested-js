import markdown from "@eslint/markdown";
import preferences from "eslint-plugin-markdown-preferences";
import paragraph from "eslint-plugin-markdown-preferences-paragraph";
import proseSpellcheck from "eslint-plugin-prose-spellcheck";

export default [{
  files: ["*.md"],
  plugins: {
    markdown,
    preferences,
    paragraph,
    "prose-spellcheck": proseSpellcheck,
  },
  language: "markdown/gfm",
  rules: {
    ...markdown.configs.recommended[0].rules,
    "preferences/heading-casing": ["error", {
      style: "Title Case",
      preserveWords: [
        "already-tested", "already-tested-js", "AGENTS.md", "JavaScript", "Node.js", "GitHub",
        "CLI", "CI", "PR", "PRs", "SHA-256", "API", "MIT", "ESLint", "npm",
      ],
    }],
    "preferences/no-heading-trailing-punctuation": "error",
    "paragraph/wrap": ["error", { width: "nowrap" }],
    "prose-spellcheck/spellcheck": ["error", {
      dictionaries: ["@cspell/dict-en_us", "./.spellcheck.txt"],
      baseDir: import.meta.dirname,
    }],
  },
}];

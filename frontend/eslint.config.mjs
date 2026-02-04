import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Downgrade errors to warnings for existing codebase
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      // React Hooks experimental rules - downgrade to warnings
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      // React Compiler rules - disable for now
      "react-compiler/react-compiler": "off",
    },
  },
  {
    ignores: [".next/", "node_modules/", "public/", "old_files/"],
  },
];

export default eslintConfig;

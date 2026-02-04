import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Unused variables: allow underscore-prefixed and ignore destructuring rest siblings
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Explicit any: disabled as proper typing would require significant refactoring
      // TODO: Re-enable after gradual type improvements
      "@typescript-eslint/no-explicit-any": "off",
      // Require imports: allow in config files (tailwind.config.js uses CommonJS)
      "@typescript-eslint/no-require-imports": "off",
      // React hooks exhaustive-deps: warn to catch potential bugs but allow suppression
      "react-hooks/exhaustive-deps": "warn",
      // setState in effect: disabled - legitimate for animations and mounting state
      "react-hooks/set-state-in-effect": "off",
      // Unescaped entities: disabled - quotes in Polish text are common and intentional
      "react/no-unescaped-entities": "off",
      // img element: disabled for landing page where external URLs and specific attributes are needed
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "warn",
      // React Hooks experimental rules - disabled as they produce false positives
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // React Compiler rules - disabled as not using React Compiler
      "react-compiler/react-compiler": "off",
    },
  },
  // Type definition files: ignore unused imports used for module augmentation
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Test files: relax rules for test utilities and fixtures
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    ignores: [".next/", "node_modules/", "public/", "old_files/"],
  },
];

export default eslintConfig;

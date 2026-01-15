import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Security plugin for detecting common vulnerabilities
  {
    plugins: {
      security,
    },
    rules: {
      // Critical security rules (errors)
      "security/detect-unsafe-regex": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-new-buffer": "error",
      "security/detect-bidi-characters": "error",
      // Warning level rules (potential issues)
      "security/detect-object-injection": "off", // Too many false positives in TypeScript
      "security/detect-non-literal-regexp": "warn",
      "security/detect-child-process": "warn",
      "security/detect-non-literal-fs-filename": "off", // Normal for WhatsApp session management
      "security/detect-non-literal-require": "off", // Needed for Node.js
      "security/detect-possible-timing-attacks": "warn",
    },
  },
  // Relax some rules that cause false positives
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn", // Downgrade from error to warning
      "@typescript-eslint/no-unused-vars": "warn",  // Downgrade from error to warning
      "react/no-unescaped-entities": "off", // French text has apostrophes
      "@typescript-eslint/no-require-imports": "off", // Needed for Node.js files
      "react-hooks/rules-of-hooks": "warn", // Baileys uses hook-like function names
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    // Node.js standalone files (not React)
    "whatsapp-service.js",
    "ecosystem.config.js",
    // Documentation/patch folders (contain incomplete code snippets)
    "PACKAGE AUDI COMPLET/**",
    "PACKAGE COMPLET  REFACTORING/**",
    "Package Complet Fourni 6 FICHIERS/**",
    "package complet MESSAGE FALLBACK D*ERREUR/**",
    "ANALYSE EXPERT AMELIORER/**",
    "__tests__/**",
  ]),
]);

export default eslintConfig;

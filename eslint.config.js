import tseslint from "typescript-eslint";
import solid from "eslint-plugin-solid/configs/v2-strict";

export default [
  { ignores: ["dist", "node_modules"] },
  ...tseslint.configs.recommended,
  { files: ["src/**/*.{ts,tsx}"], ...solid }
];

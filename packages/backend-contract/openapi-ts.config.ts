import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './packages/contracts/generated/openapi.yaml',
  output: {
    path: 'packages/backend-contract/src/generated',
  },
  plugins: ['@hey-api/typescript', 'zod'],
});

import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './packages/contracts/generated/openapi.yaml',
  output: {
    path: 'packages/api-client/src/generated',
    module: { extension: null },
  },
  plugins: [{ name: '@hey-api/client-fetch', includeInEntry: true }],
});

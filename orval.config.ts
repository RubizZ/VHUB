import { defineConfig } from 'orval';

export default defineConfig({
  henrik: {
    input: './henrik.json',
    output: {
      target: './src/lib/generated/henrik.ts',
      client: 'axios-functions',
      mode: 'split',
      override: {
        mutator: {
          path: './src/lib/henrik-axios.ts',
          name: 'henrikAxiosInstance',
        },
      },
    },
  },
});

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Next's tsconfig keeps "jsx": "preserve" for the Next compiler. Vitest still
// has to compile those components, so the React plugin turns JSX into the
// automatic runtime before the test runner parses the file.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});

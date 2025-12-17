import { defineConfig } from 'vite'
import cssInjectedByJS from 'vite-plugin-css-injected-by-js'
import solid from 'vite-plugin-solid'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.tsx',
      name: 'hfe',
      formats: ['umd'],
      fileName: () => 'hfe.js',
    },
  },
  css: {
    modules: {
      generateScopedName: '[hash:base64:5]',
    },
  },
  plugins: [
    solid(),
    cssInjectedByJS({
      styleId: 'hfe-style',
    }),
    tsconfigPaths(),
  ],
})

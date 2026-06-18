import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#ef0000',
          black: '#050505',
        },
      },
      boxShadow: {
        panel: '0 14px 36px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;

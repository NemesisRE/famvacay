import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextVitals,
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'coverage/**',
      'test-results/**',
      'next-env.d.ts',
      'node_modules/**',
      'src/generated/**',
      'scripts/**',
    ],
  },
  {
    rules: {
      // @floating-ui/react exposes refs.setFloating / refs.setReference callback setters
      // which trigger false positives in react-hooks/refs compiler rule.
      'react-hooks/refs': 'off',
      // Allow standard client-hydration mount patterns (e.g., setMounted(true))
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
];

export default config;


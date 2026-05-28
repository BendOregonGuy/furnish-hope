/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Furnish Hope palette — warm, dignified, calm
        cream:       '#F7F1E8',
        'cream-deep':'#EFE6D6',
        paper:       '#FBF7EF',
        ink:         '#1F1B16',
        'ink-soft':  '#4A433A',
        'ink-faint': '#8A8278',
        hairline:    '#E3D9C7',
        'hairline-strong': '#D2C5AC',
        terracotta:  '#B8533A',
        'terracotta-deep': '#8E3D29',
        'terracotta-soft': '#F3DBD0',
        sage:        '#6B7A5A',
        'sage-soft': '#DDE2D2',
        gold:        '#B88842',
        'gold-soft': '#F2E4CA',
        slate:       '#4F5562',
        'slate-soft':'#DCE0E6',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 0 rgba(31,27,22,0.04), 0 0 0 0.5px rgba(31,27,22,0.06)',
      },
    },
  },
  plugins: [],
};

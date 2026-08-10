// Merge into tailwind.config.ts (standard shadcn/ui config assumed).
export const themeExtend = {
  fontFamily: {
    sans: ['"Noto Naskh Arabic"', 'serif'],
    heading: ['Amiri', '"Noto Naskh Arabic"', 'serif'],
  },
  borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 4px)', sm: 'calc(var(--radius) - 6px)' },
  boxShadow: {
    card: '0 1px 2px rgba(41,37,36,0.05)',
    tooltip: '0 2px 6px rgba(41,37,36,0.18)',
  },
};
// Reminders:
// - tailwindcss-rtl not required: use logical utilities (ps-*, pe-*, start-*, end-*).
// - Progress bar fills right→left in RTL: use start-0 + width %, never left-0.
// - Fonts: <link> Google Fonts "Noto Naskh Arabic:wght@400;500;600;700" + "Amiri:wght@400;700".
// - KaTeX ^0.16 CSS must load globally; see globals.css for the RTL isolation rule.

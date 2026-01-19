/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // shadcn/ui compatible colors (must come first)
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        // shadcn border (must be string, not object)
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        // Primary colors (with shadcn compatibility)
        primary: {
          main: 'var(--color-primary-main)',
          light: 'var(--color-primary-light)',
          dark: 'var(--color-primary-dark)',
          contrast: 'var(--color-primary-contrast)',
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        // Secondary colors (with shadcn compatibility)
        secondary: {
          main: 'var(--color-secondary-main)',
          light: 'var(--color-secondary-light)',
          dark: 'var(--color-secondary-dark)',
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        // Background colors
        bg: {
          main: 'var(--color-background-main)',
          paper: 'var(--color-background-paper)',
          elevated: 'var(--color-background-elevated)',
          sidebar: 'var(--color-background-sidebar)',
          DEFAULT: 'var(--color-background-main)',
        },
        // Text colors
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
          DEFAULT: 'var(--color-text-primary)',
        },
        // Custom border colors (separate from shadcn border)
        borderColor: {
          light: 'var(--color-border-light)',
          medium: 'var(--color-border-medium)',
          dark: 'var(--color-border-dark)',
        },
        // Status colors
        status: {
          success: 'var(--color-status-success)',
          warning: 'var(--color-status-warning)',
          error: 'var(--color-status-error)',
          info: 'var(--color-status-info)',
          upcoming: 'var(--color-status-upcoming)',
          completed: 'var(--color-status-completed)',
          cancelled: 'var(--color-status-cancelled)',
        },
        // Status pairs (with background/text/border variants)
        success: {
          DEFAULT: 'var(--color-status-success)',
          bg: 'var(--color-status-success-background)',
          text: 'var(--color-status-success-text)',
          border: 'var(--color-status-success-border)',
        },
        warn: {
          DEFAULT: 'var(--color-status-warning)',
          bg: 'var(--color-status-warning-background)',
          text: 'var(--color-status-warning-text)',
          border: 'var(--color-status-warning-border)',
        },
        error: {
          DEFAULT: 'var(--color-status-error)',
          bg: 'var(--color-status-error-background)',
          text: 'var(--color-status-error-text)',
          border: 'var(--color-status-error-border)',
        },
        info: {
          DEFAULT: 'var(--color-status-info)',
          bg: 'var(--color-status-info-background)',
          text: 'var(--color-status-info-text)',
          border: 'var(--color-status-info-border)',
        },
        // Link colors
        link: {
          DEFAULT: 'var(--color-link-default)',
          hover: 'var(--color-link-hover)',
          visited: 'var(--color-link-visited)',
          active: 'var(--color-link-active)',
        },
        // Surface colors
        surface: {
          hover: 'var(--color-surface-hover)',
          selected: 'var(--color-surface-selected)',
          pressed: 'var(--color-surface-pressed)',
        },
      },
      borderRadius: {
        none: 'var(--radius-none)',
        sm: 'var(--radius-sm)',
        base: 'var(--radius-base)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        none: 'var(--shadow-none)',
        sm: 'var(--shadow-sm)',
        base: 'var(--shadow-base)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
      },
      spacing: {
        0: 'var(--spacing-0)',
        1: 'var(--spacing-1)',
        2: 'var(--spacing-2)',
        3: 'var(--spacing-3)',
        4: 'var(--spacing-4)',
        5: 'var(--spacing-5)',
        6: 'var(--spacing-6)',
        8: 'var(--spacing-8)',
        10: 'var(--spacing-10)',
        12: 'var(--spacing-12)',
        16: 'var(--spacing-16)',
        20: 'var(--spacing-20)',
        24: 'var(--spacing-24)',
        'card-padding': 'var(--spacing-card-padding)',
        'section-gap': 'var(--spacing-section-gap)',
        'element-gap': 'var(--spacing-element-gap)',
        'tight-gap': 'var(--spacing-tight-gap)',
      },
      fontFamily: {
        sans: 'var(--font-family-primary)',
        primary: 'var(--font-family-primary)',
        secondary: 'var(--font-family-secondary)',
        mono: 'var(--font-family-mono)',
      },
      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-base)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
        '3xl': 'var(--font-size-3xl)',
        '4xl': 'var(--font-size-4xl)',
      },
      fontWeight: {
        light: 'var(--font-weight-light)',
        normal: 'var(--font-weight-regular)',
        regular: 'var(--font-weight-regular)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
        bold: 'var(--font-weight-bold)',
      },
      lineHeight: {
        tight: 'var(--line-height-tight)',
        normal: 'var(--line-height-normal)',
        relaxed: 'var(--line-height-relaxed)',
      },
    },
  },
  plugins: [],
}

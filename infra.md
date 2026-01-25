# Infrastructure Documentation

## Overview

This document outlines the complete infrastructure setup for developing, testing, and deploying the CareOS Portal application. The application is a modern React-based Single Page Application (SPA) built with TypeScript, Vite, and Tailwind CSS, designed for mobile-first responsive healthcare portal experiences.

---

## Technology Stack

### Core Framework & Language
- **React**: `^19.2.0` - UI library
- **TypeScript**: `~5.9.3` - Type-safe JavaScript
- **Vite**: `^7.2.4` - Build tool and dev server
- **React Router DOM**: `^7.12.0` - Client-side routing

### UI & Styling
- **Tailwind CSS**: `^3.4.19` - Utility-first CSS framework
- **PostCSS**: `^8.5.6` - CSS processing
- **Autoprefixer**: `^10.4.23` - CSS vendor prefixing
- **shadcn/ui**: Component library (via Radix UI primitives)
- **Radix UI**: 
  - `@radix-ui/react-dialog`: `^1.1.15`
  - `@radix-ui/react-select`: `^2.2.6`
- **Lucide React**: `^0.562.0` - Icon library

### Utilities & Helpers
- **class-variance-authority**: `^0.7.1` - Component variant management
- **clsx**: `^2.1.1` - Conditional className utility
- **tailwind-merge**: `^3.4.0` - Merge Tailwind classes intelligently

### Development Tools
- **ESLint**: `^9.39.1` - Code linting
- **TypeScript ESLint**: `^8.46.4` - TypeScript-specific linting
- **React Hooks ESLint Plugin**: `^7.0.1` - React hooks linting
- **React Refresh Plugin**: `^0.4.24` - Fast Refresh support

---

## Project Structure

vns-provider-services-portal-poc2/
├── src/
│ ├── components/ # Reusable UI components
│ │ ├── layout/ # Layout components (AppShell, PageShell, etc.)
│ │ ├── ui/ # shadcn/ui components (button, card, dialog, etc.)
│ │ ├── documents/ # Document-specific components
│ │ ├── visits/ # Visit-specific components
│ │ └── landing/ # Landing page components
│ ├── pages/ # Page components (route-level)
│ ├── context/ # React Context providers
│ ├── lib/ # Utility functions and stores
│ ├── types/ # TypeScript type definitions
│ ├── design/ # Design system tokens
│ │ ├── system.json # Design system configuration
│ │ └── tokens.css # CSS custom properties
│ ├── data/ # Mock data and seed data
│ ├── App.tsx # Root component with routing
│ ├── main.tsx # Application entry point
│ └── index.css # Global styles and Tailwind imports
├── public/ # Static assets (if any)
├── index.html # HTML entry point
├── vite.config.ts # Vite configuration
├── tailwind.config.js # Tailwind CSS configuration
├── postcss.config.js # PostCSS configuration
├── tsconfig.json # TypeScript root config
├── tsconfig.app.json # TypeScript app config
├── tsconfig.node.json # TypeScript Node config
├── eslint.config.js # ESLint configuration
├── components.json # shadcn/ui configuration
├── package.json # Dependencies and scripts
└── .gitignore # Git ignore rules
---## Configuration Files### `package.json`- **Type**: `module` (ESM)- **Scripts**:  - `dev`: Start Vite dev server (`vite`)  - `build`: Type check + build (`tsc -b && vite build`)  - `lint`: Run ESLint (`eslint .`)  - `preview`: Preview production build (`vite preview`)### `vite.config.ts`- Plugin: @vitejs/plugin-react- Path alias: "@" -> "./src"- Build output: "dist" directory
tailwind.config.js
Mobile-first breakpoints:
xs: 375px (Mobile)
sm: 640px (Small mobile/landscape)
md: 768px (Tablet)
lg: 1024px (Desktop)
xl: 1280px (Large desktop)
2xl: 1536px (Extra large desktop)
Design tokens: Integrated from src/design/tokens.css
shadcn/ui compatibility: Full support for shadcn color system
tsconfig.json
Module system: ESNext
Target: ES2022
JSX: react-jsx
Strict mode: Enabled
Path aliases: @/* -> ./src/*
eslint.config.js
Base: ESLint flat config
Plugins: React Hooks, React Refresh, TypeScript ESLint
Ignores: dist directory
postcss.config.js
Plugins: Tailwind CSS, Autoprefixer

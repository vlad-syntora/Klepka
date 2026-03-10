# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Klepka is a B2B marketing website for a Salesforce CRM consulting firm. It showcases services, team/founders, pricing, and integrations. Built as a React SPA with Vite.

## Commands

```bash
npm run dev        # Start dev server (binds to 0.0.0.0)
npm run build      # Production build
npm run lint       # ESLint validation
npm run lint:fix   # Auto-fix lint issues
npm run typecheck  # TypeScript type checking (no emit)
```

No test suite is configured.

## Architecture

**Routing** (`src/app/App.tsx`): React Router v7. All pages share `Header`/`Footer` except `/card/:slug` (FounderCardPage), which renders in isolation.

**Pages** (`src/app/pages/`): Home, About, Partners, Pricing, Careers, FounderCardPage. Content is mostly static/configured data.

**Config layer** (`src/config/`): Team members and founders are defined in `teamConfig.ts` as typed data structures. Salesforce certificates are mapped in `certificatesConfig.ts`. When updating team info or adding founders, edit these files — pages consume them directly.

**UI components** (`src/app/components/`):
- `ui/` — Radix UI primitives (shadcn-style, ~50 components)
- `figma/` — Figma design exports as React components
- Root-level components: `Header`, `Footer`, `SEOHead`, `CrmChallengesForm`, etc.

**Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed). Custom theme variables in `src/styles/theme.css`. Path alias `@/*` maps to `src/*`.

**Contact forms** (`src/app/lib/emailjs.ts`): Form submissions go through EmailJS. Requires `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY` environment variables (see `.env.example`).

**SEO**: `SEOHead` component uses React Helmet Async. Structured data (JSON-LD) for founders is generated dynamically in `About.tsx` and `FounderCardPage.tsx`.

## Key Conventions

- TypeScript strict mode; no `any` unless absolutely necessary
- `@/*` import alias for all `src/` imports
- Animation via `motion` library (not `framer-motion` directly)
- Icons: Lucide React for UI icons, MUI Icons for specific cases
- Component variants via `class-variance-authority` (CVA)
- `clsx` + `tailwind-merge` for conditional classNames (see `src/app/lib/utils.ts`)

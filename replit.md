# Cartel Bio Page - Dark Web/Watchdogs Aesthetic

## Overview

This is a single-page bio/landing page for "CARTEL" - a Discord community with a dark web/hacker aesthetic inspired by the Watchdogs game series. The application features a cyberpunk-themed interface with terminal-style UI elements, glitch effects, and neon color schemes. Built as a modern React single-page application with Express backend, it serves as an immersive gateway to join the CARTEL Discord community.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server for fast HMR and optimized production builds
- **Wouter** for lightweight client-side routing (currently single route)
- **TanStack Query (React Query)** for server state management and data fetching

**UI Component System**
- **shadcn/ui** component library with Radix UI primitives (extensive set of accessible components)
- **Tailwind CSS** for utility-first styling with custom dark web theme configuration
- **Custom Design System** defined in `design_guidelines.md` featuring:
  - Dark mode-first color palette (deep charcoal backgrounds, neon cyan/green accents)
  - Monospace typography (JetBrains Mono, Space Mono) for terminal aesthetic
  - Glitch effects and scanline overlays for cyberpunk atmosphere
  - CRT curvature effects and asymmetric layouts

**Styling Architecture**
- CSS variables for theming defined in `client/src/index.css`
- Custom Tailwind configuration with extended color palette for dark web aesthetic
- Hover/active elevation effects using CSS variables (`--elevate-1`, `--elevate-2`)
- Border styling using opacity-based outlines for buttons and badges

**State Management**
- React Query for async state and API communication
- React hooks for local component state
- Context API for global UI state (toasts, tooltips)

### Backend Architecture

**Server Framework**
- **Express.js** with TypeScript for the HTTP server
- **Node.js** runtime with ES modules
- Development/production mode handling with environment-based configuration

**Development Environment**
- Vite middleware integration in development for HMR
- Custom error overlay for runtime errors (Replit-specific)
- Development banner and cartographer plugins (Replit tooling)

**API Design**
- RESTful API pattern with `/api` prefix for all routes
- Request/response logging middleware with timing metrics
- Centralized error handling middleware
- JSON body parsing with URL-encoded form support

**Storage Layer**
- **In-Memory Storage** (`MemStorage` class) for user data during development
- Interface-based design (`IStorage`) allowing easy migration to persistent storage
- User management methods (getUser, getUserByUsername, createUser)
- UUID-based user identification

### Data Architecture

**Database Schema** (Drizzle ORM)
- **PostgreSQL** dialect configured via `@neondatabase/serverless`
- Schema defined in `shared/schema.ts`:
  - Users table with id (UUID), username (unique), password fields
- **Drizzle Kit** for schema migrations (output to `./migrations`)
- Zod integration for runtime validation via `drizzle-zod`

**Type Safety**
- Shared types between client/server via `shared/` directory
- Inferred types from Drizzle schema (`User`, `InsertUser`)
- Zod schemas for validation (`insertUserSchema`)

### External Dependencies

**Third-Party UI Libraries**
- **Radix UI** - Comprehensive accessible component primitives (accordion, dialog, dropdown, etc.)
- **FontAwesome** - Icon library for brand icons (Discord, Telegram)
- **Lucide React** - Icon system for UI elements
- **cmdk** - Command palette component
- **Vaul** - Drawer component primitives
- **Embla Carousel** - Carousel functionality

**Utility Libraries**
- **class-variance-authority** - Type-safe component variant management
- **clsx** & **tailwind-merge** - Conditional className utilities
- **date-fns** - Date formatting and manipulation
- **nanoid** - Unique ID generation

**Database & ORM**
- **Drizzle ORM** - Type-safe SQL query builder and schema manager
- **@neondatabase/serverless** - PostgreSQL connection for serverless environments
- **connect-pg-simple** - PostgreSQL session store (for future auth implementation)

**Development Tools**
- **Replit Plugins** - Cartographer, dev banner, runtime error overlay (development only)
- **esbuild** - Production bundling for server code
- **tsx** - TypeScript execution for development server

**Build & Validation**
- **Zod** - Runtime type validation
- **React Hook Form** - Form state management
- **@hookform/resolvers** - Zod resolver integration

**Current Implementation Note**
The application currently uses in-memory storage for development. The Drizzle configuration and PostgreSQL schema are set up but not actively connected to the runtime storage implementation. Future integration would involve replacing `MemStorage` with a Drizzle-based implementation using the defined schema.
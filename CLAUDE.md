# Co-Curricular CLAUDE.md

NLS Activity Management System — React + Supabase + Vite

## Project Overview

**Purpose:** Activity (workout) scheduling and enrollment management for NLS middle school (Kigali, Rwanda)  
**Tech Stack:** React 18 + TypeScript + Tailwind + shadcn/ui, Supabase (Postgres + Auth), Vite  
**Deployment:** Lovable (auto-deploys on main branch)  
**Repository:** [ivanluckz/co-curricular](https://github.com/ivanluckz/co-curricular)

## Setup & Development

```bash
# Install dependencies
npm install

# Start dev server (Vite)
npm run dev

# Build for production
npm run build

# Lint and format
npm run lint
npm run format
```

## Key Features

- **Admin Dashboard:** Create/manage workouts, assign teachers, view analytics
- **Student Enrollment:** Browse activities and sign up
- **Teacher Management:** Assign teachers to workouts
- **Data Export:** Excel (XLSX) and CSV export of workouts, enrollments, and teacher assignments
- **Premium Themes:** Configurable color themes via CSS variables (Midnight Athlete, Fresh Energy, Elite Focus)
- **Animations:** Discord Nitro-style effects (particles, confetti, ripples, glitch, pulse)

## Project Structure

```
src/
├── pages/           # Route components (AdminWorkouts, StudentDashboard, etc.)
├── components/      # Reusable UI components
├── lib/
│   ├── supabase.ts  # Supabase client config
│   ├── theme.ts     # Theme seeding and color utilities
│   └── workout-export.ts  # Excel/CSV export functions
├── App.tsx          # Main router
└── index.css        # Global styles

public/
├── themes/          # Premium theme CSS files
│   ├── midnight-athlete.css
│   ├── fresh-energy.css
│   └── elite-focus.css
└── animations/      # Animation libraries
    ├── discord-nitro.js
    └── discord-nitro.css

vite.config.ts      # Vite bundler config
```

## Supabase Setup

**Tables:**
- `profiles` — User accounts (id, full_name, email, role)
- `workouts` — Activity definitions (id, name, description, days_of_week, capacity, is_active)
- `workout_teachers` — Teacher assignments (workout_id, teacher_id)
- `signups` — Student enrollments (id, workout_id, student_id, created_at)

**Auth:** Supabase Auth (email + password)

## GitHub Authentication (Claude Code)

Claude Code requires a GitHub Personal Access Token to push commits.

**Setup (one-time):**
1. Go to GitHub **Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token**
3. Name: `claude-code-git`
4. Select scopes:
   - ✓ `repo` (full control of private repos)
   - ✓ `gist`
5. Set expiration: 90 days
6. **Copy token immediately** (won't be shown again)
7. Paste into Claude Code when prompted
8. Git will cache it in `~/.git-credentials` (never committed)

**For subsequent sessions:**
- Token is cached and reused automatically
- If expired, generate a new one and update when git prompts

## Common Tasks

### Add a New Workout
1. Navigate to **Admin Dashboard → Workouts**
2. Click **"New Workout"**
3. Fill in name, description, days of week, capacity
4. Click **"Create"** (auto-saves to Supabase)

### Export Enrollment Data
1. Navigate to **Admin Dashboard → Workouts**
2. Click **"Excel"** for XLSX (5 sheets: Summary, Workouts, Teachers, Enrollments, Detailed)
3. Click **"CSV"** for Google Sheets import

### Apply a Theme
Themes are applied via `setTheme()` utility. See `src/lib/theme.ts` for available theme keys.

## Known Issues & TODOs

- ~17 remaining React hook dependency warnings (edge cases, non-blocking)
- Main bundle is ~3.7 MB (consider code splitting for large routes)
- ~343 "any" type errors (incremental TypeScript improvements)
- Browserslist is 10 months old (update with `npx browserslist@latest --update-db`)

## Commits & Deployment

- Auto-deploys to Lovable on `main` branch
- Each commit should have a clear message (e.g., "Add workout export to Excel and CSV")
- Use conventional commit style when possible: `feat:`, `fix:`, `refactor:`, `docs:`

## ESLint & Code Quality

```bash
# Check for lint errors
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix

# Format code
npm run format
```

## Performance & Optimization

- Vite handles bundling and minification
- React components use `useCallback` to minimize re-renders
- Supabase queries are optimized with proper indexing
- CSS animations use GPU acceleration (transform, opacity)

## Contact & Support

- **Project Lead:** Ivan Lucky
- **Repo:** https://github.com/ivanluckz/co-curricular
- **Deployment:** Lovable platform

# Universal School Timetable — Native Android PWA

Transform the single-file Universal School Timetable into an installable Android Progressive Web App (PWA) and mobile-optimized application with native Android Material Design 3 ergonomics, persistent offline storage, and 100% feature parity with the original system.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user in Phase 1 and govern the entire implementation.

- **Delivery Method (Confirmed)**: Installable Android PWA with complete offline support via Service Worker, Web App Manifest (`display: standalone`), and in-app install banner with guided prompts for Android and iOS. Also maintains full backward-compatibility with Android WebView wrapper bridges (`window.AndroidPrint`, `window.AndroidShare`, `window.AndroidBackup`, `window.AndroidImage`).
- **Visual Design System (Confirmed)**: Native Android Material 3 (MD3) design language featuring a floating/docked bottom navigation bar, top app bar with contextual actions, rounded cards (`rounded-2xl` / `rounded-3xl`), Material bottom sheets with drag handles, ergonomic $\ge 44\text{px}$ touch targets, and full Dark Mode support with high-contrast legibility.
- **Feature Scope (Confirmed)**: Complete 1-to-1 port of all existing capabilities:
  1. Master Data management (Teachers with Groups & Grades, Classes with Incharges & Sections, Subjects).
  2. Timetable Editor with both **Fast Add Mode** and **Grid View**, including 2nd-subject combinations (Parallel, Day Rotation, and Same Teacher) and conflict auto-detection.
  3. School Setup with custom periods, day counts, break positions, and separate Friday/Jumma prayer timings.
  4. View Timetables (Whole School, Teachers Wise, School Timings with Friday split, Class Wise, Teacher Wise).
  5. Substitute Board with workload and 4-tier Group/Grade matching (Science/Arts/IT, SST/EST/PST), long-term leave ranges, and single-date short leaves.
  6. Free Staff by Period and Teachers Roster.
  7. Client-side Excel (`.xlsx`) export using custom XML/ZIP generation, PNG timetable image rendering & sharing, and print stylesheet layouts.

---

## 1. Overview & Core Concept

- **What It Does**: A complete, offline-first school timetable management system engineered to look, feel, and install like a native Android app. School administrators, headmasters, and coordinators can build weekly class schedules, manage teacher assignments, resolve scheduling collisions, calculate substitutions on absent days, and export print-ready schedules and multi-tab Excel workbooks directly from their phones or desktop screens.
- **Target Audience / Persona**: School administrators, principals, vice-principals, and timetable coordinators in primary and secondary schools.
- **Key Value**: Eliminates reliance on complex desktop software or internet access; allows instant timetable editing with thumb-zone ergonomics, quick conflict resolution, and immediate exports to WhatsApp, Downloads, or A4 paper.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Quick-Access Bottom Navigation**:
   - The user navigates effortlessly via an Android Material 3 bottom navigation bar with 5 primary destinations: **Home / Dashboard**, **Editor**, **Views**, **Substitute**, and **More** (expanding School Setup, Master Data, Free Staff, Roster, and Print).
2. **Fast Add & Editing**:
   - In the Timetable Editor, the user selects Class $\rightarrow$ Period $\rightarrow$ Subject $\rightarrow$ Teacher in a clean Material card or grid. Upon tapping Save, changes persist instantly to `localStorage`, the next empty period is automatically selected, and any double-booked teacher triggers an immediate red indicator with a 1-tap "Mark Intentional" or "Fix" shortcut.
3. **Substitute Planning on the Go**:
   - When a teacher is absent, the user opens the Substitute Board, selects the date, and immediately views 4 columns: Period Info, Workload Recommendation, Group/Grade Match (e.g. Science SST $\leftrightarrow$ Science EST), and Free Staff.
4. **Export & Sharing**:
   - Tapping "Save as Image", "Share", or "Download Excel (.xlsx)" produces client-side binary files instantly using HTML5 Canvas or offline ZIP/XML construction, opening Android's native share sheet or downloading the `.xlsx` file.

### Visual Identity & Theme (Material 3)

- **Aesthetic Direction**: Android Material 3 with tactile surfaces, fluid elevation, and purposeful typography.
- **Color Palette**:
  - Primary: Deep Emerald Pine (`#1B4D3E` / Dark: `#4E9670`) for institutional authority.
  - Secondary Accent: Warm Terracotta Ochre (`#B4791F` / Dark: `#FBBF24`) for warnings and notices.
  - Error: Crimson Alert (`#B23A32` / Dark: `#E06A5F`) for teacher conflicts.
  - Surface Background: Light `#F8F9FA` / Dark `#121212` with subtle container tonal elevation (`bg-surface-container`).
- **Typography & Hierarchy**:
  - Display & Headings: Clean geometric sans (`Plus Jakarta Sans` or system Roboto) with balanced weights.
  - Timetable Data & Metrics: Strict tabular figures (`font-mono tabular-nums`) for period numbers, times, and workload counts.
- **Mobile Ergonomics**:
  - Touch targets minimum $48\text{px} \times 48\text{px}$.
  - Bottom sheets with drag handles and smooth slide-up animation for searching teachers and subjects.
  - 15% mobile sticky surface cap (top app bar + bottom bar strictly within limits).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full React 19 + TypeScript Component Architecture**:
  - *Chosen Approach*: Refactor the monolithic script into modular React 19 hooks and components (`useTimetableData`, `usePWAInstall`, `TimetableEditor`, `SubstituteBoard`, `ViewsSection`, `PrintingSection`, `ExcelExport`).
  - *Why*: Provides reactive state updates, eliminates DOM string manipulation, enables instant Undo/Redo across any view, and ensures strict type safety.
  - *Alternatives Considered*: Keeping raw innerHTML strings would lead to state desynchronization and brittle event binding on mobile touch devices.
- **Decision 2: Local Persistence & Scenario Management**:
  - *Chosen Approach*: Store state in `localStorage` under `universalTimetable` with automatic version migration, backup export/import to `.json`, and named scenario snapshots (e.g., "Ramadan Timings", "Exam Week").
  - *Why*: Instant loading, zero network latency, 100% offline reliability.
- **Decision 3: Dual Android Bridge & Web Standard APIs**:
  - *Chosen Approach*: Detect `window.AndroidPrint`, `window.AndroidShare`, `window.AndroidBackup`, and `window.AndroidImage` if wrapped in an Android WebView APK; seamlessly fall back to standard Web APIs (`navigator.share`, `window.print()`, Blob downloads) when running as a PWA in Chrome/Firefox.
  - *Why*: Guarantees the application works natively both inside an APK container and installed as a standalone PWA.

---

## 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│                   Android PWA Container                          │
│  (Service Worker + Web App Manifest + Android Bridge Detection)  │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│                   App State & Persistence Store                  │
│       (React Context / Custom Hook: useTimetableData)            │
│       - Data Normalization, Undo/Redo History, LocalStorage      │
│       - Conflict Engine, Teacher Load Cache, Leave Calculation   │
└───────┬──────────────┬──────────────┬──────────────┬─────────────┘
        │              │              │              │
┌───────▼──────┐┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐
│  Dashboard   ││ Master Data ││  Timetable  ││  Substitute │
│  & Overview  ││ & Classes   ││  Editor     ││  & Roster   │
│  (Stats,     ││ (Teachers,  ││  (Fast Add, ││  (Group/    │
│  Leaves,     ││  Subjects,  ││  Grid View, ││   Grade,    │
│  Validation) ││  Incharges) ││  2nd Subj)  ││   Leaves)   │
└──────────────┘└─────────────┘└─────────────┘└─────────────┘
        │              │              │              │
┌───────▼──────────────▼──────────────▼──────────────▼──────┐
│                   Output & Export Engine                         │
│  - Multi-tab Excel (.xlsx) generator (ZIP + OpenXML)             │
│  - HTML5 Canvas PNG Renderer (Save & Native Android Share)       │
│  - A4 Landscape Print Engine (Classroom, Staff, Cut-out Grids)   │
└──────────────────────────────────────────────────────────────────┘
```

### Core Entities & Data Structures

- `TimetableData`:
  - `schoolName`, `academicYear`, `printNote`, `wholeTitle`, `allTeachersTitle`.
  - `periods`: `number[]` (e.g. `[1, 2, 3, 4, 5, 6, 7, 8]`).
  - `breakAfter`: `number` (period after which recess occurs).
  - `daysPerWeek`: `number` (4 to 7).
  - `classes`: `[name, incharge, section, subjects[], teachers[], slot2[]][]`.
  - `slot2`: `{ subject, teacher, mode: 'parallel' | 'rotation' | 'same', days: number[] } | null`.
  - `teachers`: `string[]`.
  - `teacherInfo`: Record of `{ qual: string, rank: string, desig: string }`.
  - `subjects`: `string[]`.
  - `teacherLeaves`: Record of `dateStr -> teacherNames[]`.
  - `longLeaves`: `{ id, teacher, from, to, reason }[]`.
  - `conflictExceptions`: `{ period, teacher, classes: string[], days: number[] }[]`.
  - `periodTimes` & `fridayTimings`: Timings, assembly start/end, and Friday-specific recess rules.

### Progressive Web App (PWA) Assets

- Configure `vite-plugin-pwa` in `vite.config.ts` with `registerType: 'autoUpdate'`.
- Manifest with `display: 'standalone'`, `theme_color: '#1B4D3E'`, `background_color: '#F8F9FA'`, mobile icons (192px, 512px, maskable), and `start_url: '/'`.
- Install prompt hook (`usePWAInstall`) and UI button banner for 1-tap installation on Android.
- Safe Area Insets (`env(safe-area-inset-bottom)`) for gesture bar and notch compatibility on modern Android devices.

---

## 5. Execution Stages

1. **PWA & Dependencies Setup**:
   - Install `vite-plugin-pwa` and icon assets in `public/`.
   - Configure `vite.config.ts`, `manifest.json`, and safe-area responsive meta tags.
2. **Core Data Engine & State Store**:
   - Port timetable data structure, normalization, cache, and validation engine into typed TypeScript models and a dedicated `useTimetable` React hook.
   - Implement multi-level Undo/Redo (`Ctrl+Z`, `Ctrl+Y`, and floating action buttons).
3. **Android Material 3 UI Shell**:
   - Implement top Material bar with search, dark mode toggle, and PWA Install action.
   - Build bottom navigation bar with active badges and "More" sheet.
   - Create Material 3 Bottom Sheet modal for mobile picker selection (classes, teachers, subjects).
4. **Views & Editor Implementation**:
   - Build **Dashboard** with quick statistics, today's leaves, and active conflict validator.
   - Build **School Setup** with periods, Friday timings, logo upload, scenario manager, and JSON backup.
   - Build **Master Lists** (Teachers with Group/Grade, Classes with Incharge, Subjects) with edit/reorder.
   - Build **Timetable Editor** supporting both **Fast Add** (mobile form with auto-advancing empty periods) and **Grid View**, complete with 2nd-subject configuration (Parallel / Rotation / Same teacher).
   - Build **Substitute Board** with 4-column matching, long leaves manager, and short leaves picker.
   - Build **Free Staff** and **Teachers Roster** tables.
5. **Export & Print System**:
   - Port HTML5 Canvas high-resolution PNG rendering and native Web Share / Android Image bridge.
   - Port pure client-side Excel (`.xlsx`) multi-tab generator.
   - Port print stylesheets for whole school, teachers wise, classroom cards, school timings, and cut-out teacher grids.
6. **Verification & Build**:
   - Verify zero compile errors with `compile_applet` and test all touch interactions, dark mode, and export triggers.

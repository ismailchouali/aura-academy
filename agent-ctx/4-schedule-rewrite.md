---
## Task ID: 4
Agent: Main Agent
Task: Rewrite schedule-view.tsx with table grid, service colors, conflict detection, and full session spanning

### Work Summary

#### 1. API Route Updates (`/src/app/api/schedules/route.ts`)
**Conflict Detection in POST Handler:**
- Added helper functions: `timeToMinutes()`, `timesOverlap()`, `checkConflicts()`
- Arabic day name map for error messages
- Before creating schedules, checks all days for:
  - Classroom conflicts: same classroom + overlapping time on same day
  - Teacher conflicts: same teacher + overlapping time on same day
- Returns 409 status with detailed conflict info array
- Conflict message format: "هذه القاعة مشغولة في [day] من [start] إلى [end] ([subject])"

#### 2. API Route Updates (`/src/app/api/schedules/[id]/route.ts`)
**Conflict Detection in PUT Handler:**
- Same conflict check logic as POST, but excludes the current schedule ID
- Returns 409 with conflict details if found

#### 3. Schedule View Complete Rewrite (`/src/components/views/schedule-view.tsx`)

**New Layout - Single Table Grid with Day Tabs:**
- 7 day tabs at top (الأحد through السبت) with session count badges
- Each day shows a unified timetable grid
- Columns: Time (70px fixed) + one column per classroom
- Rows: 30-minute time slots from 11:00 to 22:30 (24 slots)
- Each classroom column is a relative container with sessions positioned absolutely

**Service-Based Color Coding (per task spec):**
- Cours de Soutiens: teal/green (bg-teal-100/50 text-teal-800/600 border-teal-300/200)
- Langues: amber/yellow (bg-amber-100/50 text-amber-800/600 border-amber-300/200)
- Informatique/IT: purple (bg-purple-100/50 text-purple-800/600 border-purple-300/200)
- Préparation Concours: rose/pink (bg-rose-100/50 text-rose-800/600 border-rose-300/200)
- Trial sessions: lighter pastel colors + dashed border
- Fixed sessions: full colors + solid border

**Session Duration Spans Full Time:**
- Sessions positioned absolutely using `top` offset from start time
- Height calculated based on duration (30 min = 48px per slot)
- A 1.5h session (11:00-12:30) visually spans 3 rows
- Helper functions: `getSlotTop()`, `getSessionHeight()`, `getSlotCount()`

**Conflict Detection:**
- Client-side: checks against existing schedules before submitting
- Server-side: POST/PUT handlers return 409 with conflict details
- Error display: red alert box with conflict messages (🏫 for classroom, 👨‍🏫 for teacher)
- Prevents form submission on conflict

**Session Form:**
- Session type: fixed (radio with CalendarDays icon) / trial (radio with Zap icon)
- Day selection: single dropdown for trial, recurring checkboxes for fixed
- Time: start/end selectors with duration indicator showing hours/minutes
- Classroom: dropdown with capacity info
- Subject: grouped by service (SelectGroup)
- Level: filtered by selected subject
- Teacher: filtered by selected subject
- Group name: optional text input
- Validation: all required fields, time range, duration, conflicts

**Additional Features:**
- Print button: opens formatted schedule in new window for printing
- Session type filter tabs (all/fixed/trial) 
- Session count per day shown on day tab badges
- Hover effects with edit/delete action buttons on schedule cells
- Loading skeletons, empty states for no classrooms
- Duration indicator in form when both times selected
- Spinner on submit button

**Quality:**
- ESLint passes with zero errors
- Dev server compiles successfully
- All text Arabic, RTL layout
- Uses shadcn/ui components throughout
- Responsive with ScrollArea and min-width for grid

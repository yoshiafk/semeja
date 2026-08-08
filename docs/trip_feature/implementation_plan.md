# Travel Plans (Perjalanan) Module — Full Implementation Plan

**Architecture**: DB-backed (PostgreSQL, seeded from `itinerary_semarang_jogja.md`), REST API, React frontend.
**Design Philosophy**: Mobile-first, single-thumb reachable, high-contrast, PWA-offline-ready.

---

## Research: Industry Feature Benchmark

From TripIt, Wanderlog, Stippl, Google Travel (2024–2025):

| Feature | Industry Standard | This Plan |
|---|---|---|
| Countdown / trip status | Home screen banner | ✅ HomeHub ModuleCard + trip header |
| Day-by-day timeline | Collapsible, color-coded cards | ✅ TripDayCard component |
| Opening hours + alerts | Inline status chip + warning banners | ✅ Per-item badge + day banner |
| Google Maps deep-link | "Get Directions" CTA | ✅ "Buka Maps" pill on each item |
| Hotel info hub | Card + address + distances | ✅ TripHotelCard with distance table |
| Budget tracker | Category breakdown + per-person | ✅ TripBudgetTable with toggle |
| WhatsApp share | Day summary formatter | ✅ Extends existing `whatsapp.ts` |
| City / phase filter | Destination filter chips | ✅ Semarang 🟢 / Yogyakarta 🟣 |
| Offline access | PWA cache | ✅ All data from DB → cached on load |
| Packing checklist | localStorage per-item check | ✅ V2 stretch |

---

## Open Questions → Resolved

> [!IMPORTANT]
> **Data layer**: DB-backed. First trip seeded from `itinerary_semarang_jogja.md` via a seed script. Future trips can be added via API.

> [!NOTE]
> **Navigation**: "Perjalanan" ModuleCard on HomeHub (no new bottom tab — bar stays at 5).

---

## Part 1: Database Schema

### New Tables in `server/db.js` `initDB()`

```sql
-- ── Trips Module ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trips (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(100) NOT NULL UNIQUE,     -- 'semarang-jogja-2026'
  title       VARCHAR(200) NOT NULL,
  subtitle    VARCHAR(300) DEFAULT '',
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  participant_count INTEGER DEFAULT 0,
  transport   TEXT DEFAULT '',                   -- JSON array string: '["Kereta","Travel"]'
  pace        VARCHAR(100) DEFAULT '',
  status      VARCHAR(20) DEFAULT 'upcoming',   -- upcoming, on_trip, done
  cover_city  VARCHAR(100) DEFAULT '',
  created_by  INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_hotels (
  id           SERIAL PRIMARY KEY,
  trip_id      INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,
  city         VARCHAR(100) NOT NULL,
  address      TEXT NOT NULL,
  maps_url     TEXT DEFAULT '',
  check_in     DATE NOT NULL,
  check_out    DATE NOT NULL,
  sort_order   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trip_hotel_distances (
  id          SERIAL PRIMARY KEY,
  hotel_id    INTEGER REFERENCES trip_hotels(id) ON DELETE CASCADE,
  destination VARCHAR(200) NOT NULL,
  distance_km VARCHAR(20) NOT NULL,          -- '±1.5 km'
  duration    VARCHAR(50) NOT NULL,          -- '~5 menit'
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trip_days (
  id           SERIAL PRIMARY KEY,
  trip_id      INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  day_number   INTEGER NOT NULL,             -- 1–8
  date         DATE NOT NULL,
  label        VARCHAR(100) NOT NULL,        -- 'Minggu, 16 Agustus'
  city         VARCHAR(50) NOT NULL,         -- 'semarang', 'yogyakarta', 'transit'
  area_note    TEXT DEFAULT '',              -- teal info banner
  warning_note TEXT DEFAULT '',             -- amber warning banner
  UNIQUE(trip_id, day_number)
);

CREATE TABLE IF NOT EXISTS trip_schedule_items (
  id               SERIAL PRIMARY KEY,
  day_id           INTEGER REFERENCES trip_days(id) ON DELETE CASCADE,
  time_start       VARCHAR(10) NOT NULL,     -- '09.00'
  time_end         VARCHAR(10) DEFAULT '',   -- '11.00'
  name             VARCHAR(300) NOT NULL,
  activity_type    VARCHAR(30) NOT NULL,     -- food, attraction, transit, hotel, event, shopping, leisure
  location         TEXT DEFAULT '',
  area             VARCHAR(200) DEFAULT '',
  maps_url         TEXT DEFAULT '',
  notes            TEXT DEFAULT '',
  opening_hours    VARCHAR(200) DEFAULT '',  -- 'Buka 06.00–14.00'
  is_highlight     BOOLEAN DEFAULT false,
  is_cash_only     BOOLEAN DEFAULT false,
  requires_booking BOOLEAN DEFAULT false,    -- triggers 'BOOK H-1' badge
  is_optional      BOOLEAN DEFAULT false,
  sort_order       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trip_budget_rows (
  id              SERIAL PRIMARY KEY,
  trip_id         INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  category        VARCHAR(200) NOT NULL,
  detail          VARCHAR(300) DEFAULT '',
  amount_rp       INTEGER DEFAULT 0,         -- 0 = variable/TBD
  is_accommodation BOOLEAN DEFAULT false,
  is_total_row    BOOLEAN DEFAULT false,
  sort_order      INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trip_days_trip ON trip_days(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_schedule_day ON trip_schedule_items(day_id);
CREATE INDEX IF NOT EXISTS idx_trip_hotels_trip ON trip_hotels(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_budget_trip ON trip_budget_rows(trip_id);
```

---

## Part 2: Seed Script

### [NEW] `server/scripts/seed-trip-semarang-jogja.js`

A one-off Node.js script that inserts the full Semarang–Jogja itinerary from `itinerary_semarang_jogja.md` into the DB. Idempotent (`ON CONFLICT DO NOTHING` on the slug).

Structure:
```js
// 1. INSERT INTO trips — title, slug, dates, 3 participants
// 2. INSERT INTO trip_hotels — Djajanti House + Ndalem Cokro with distances
// 3. INSERT INTO trip_days — 8 days (Day 4 split into afternoon as day 4b)
// 4. INSERT INTO trip_schedule_items — all ~55 items across 8 days,
//    including is_cash_only, requires_booking, opening_hours flags
// 5. INSERT INTO trip_budget_rows — 7 rows + 2 total rows
```

Also registered as a migration step in `server/scripts/run-migrations.js`.

---

## Part 3: REST API

### [NEW] `server/routes/trips.js`

```
GET  /api/trips               → list all trips (summary cards)
GET  /api/trips/:slug         → full trip detail (days + schedule + hotels + budget)
GET  /api/trips/:slug/days    → days only (for day selector strip)
POST /api/trips               → create trip (admin only)
PUT  /api/trips/:slug         → update trip metadata (admin only)
```

Response shape for `GET /api/trips/:slug`:
```json
{
  "id": 1,
  "slug": "semarang-jogja-2026",
  "title": "Semarang — Yogyakarta",
  "start_date": "2026-08-16",
  "end_date": "2026-08-23",
  "status": "upcoming",
  "participant_count": 3,
  "hotels": [ { ...hotel, "distances": [...] } ],
  "days": [ { ...day, "schedule": [...items] } ],
  "budget": [ ...rows ]
}
```

### [MODIFY] `server/app.js`
```diff
+ const tripsRouter = require('./routes/trips');
+ app.use('/api/trips', tripsRouter);
```

---

## Part 4: Frontend Types & API Client

### [NEW] `src/types/trip.ts`
```ts
export type ActivityType =
  | 'food' | 'attraction' | 'transit' | 'hotel'
  | 'event' | 'shopping' | 'leisure';

export type TripStatus = 'upcoming' | 'on_trip' | 'done';
export type TripCity = 'semarang' | 'yogyakarta' | 'transit';

export interface ScheduleItem {
  id: number;
  time_start: string;
  time_end?: string;
  name: string;
  activity_type: ActivityType;
  location?: string;
  area?: string;
  maps_url?: string;
  notes?: string;
  opening_hours?: string;
  is_highlight: boolean;
  is_cash_only: boolean;
  requires_booking: boolean;
  is_optional: boolean;
}

export interface TripDay {
  id: number;
  day_number: number;
  date: string;
  label: string;
  city: TripCity;
  area_note?: string;
  warning_note?: string;
  schedule: ScheduleItem[];
}

export interface TripHotel {
  id: number;
  name: string;
  city: string;
  address: string;
  maps_url?: string;
  check_in: string;
  check_out: string;
  distances: { destination: string; distance_km: string; duration: string }[];
}

export interface TripBudgetRow {
  category: string;
  detail: string;
  amount_rp: number;
  is_accommodation: boolean;
  is_total_row: boolean;
}

export interface TripSummary {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  start_date: string;
  end_date: string;
  status: TripStatus;
  participant_count: number;
  transport: string[];
  pace: string;
}

export interface TripDetail extends TripSummary {
  hotels: TripHotel[];
  days: TripDay[];
  budget: TripBudgetRow[];
}
```

### [MODIFY] `src/lib/api.ts`
Add trip API functions:
```ts
export const getTrips = () => api.get<TripSummary[]>('/trips');
export const getTripDetail = (slug: string) => api.get<TripDetail>(`/trips/${slug}`);
```

---

## Part 5: Mobile-First UI/UX Design Spec

### Design Principles (mobile-first)
1. **44px minimum tap targets** — all buttons, chips, icons
2. **Single-thumb zone** — primary actions (Maps, Share) in bottom 60% of screen
3. **Sticky contextual header** — stays with you while scrolling
4. **No horizontal scrolling** on main content — only the day selector strip scrolls horizontally
5. **Progressive disclosure** — days collapse by default; expand to see items
6. **High contrast** — text ≥ 4.5:1 ratio, important warnings amber/red, never rely on color alone
7. **Smooth transitions** — 200ms ease for collapse/expand, no janky layout shifts

### Color System (extends existing app palette)

| Token | Usage | Value |
|---|---|---|
| `city-semarang` | Semarang day accents | `hsl(142, 60%, 40%)` (green) |
| `city-yogyakarta` | Yogyakarta day accents | `hsl(270, 55%, 50%)` (purple) |
| `activity-food` | Food/culiner items | `hsl(38, 90%, 50%)` (amber) |
| `activity-attraction` | Landmarks, museums | `hsl(210, 80%, 50%)` (blue) |
| `activity-transit` | Travel, transport | `hsl(0, 0%, 55%)` (gray) |
| `activity-event` | Concerts, shows | `hsl(290, 65%, 50%)` (violet) |
| `activity-hotel` | Hotel check-in/out | `hsl(170, 55%, 42%)` (teal) |
| `activity-shopping` | Oleh-oleh, toko | `hsl(330, 60%, 50%)` (pink) |
| `banner-info` | Area/tip banner | `hsl(200, 70%, 95%)` bg, blue text |
| `banner-warn` | Warning banner | `hsl(38, 100%, 95%)` bg, amber text |

---

### Screen 1: Trip List Page `/trips`

```
┌────────────────────────────────┐
│ ← Perjalanan           [+New]  │  ← sticky header (admin shows + button)
├────────────────────────────────┤
│                                │
│  ╔══════════════════════════╗  │
│  ║  🟢━━━━━━━━━━━━━━━━🟣   ║  │  ← gradient: green (Semarang) → purple (Jogja)
│  ║                          ║  │
│  ║  Semarang — Yogyakarta   ║  │
│  ║  16 – 23 Agustus 2026   ║  │
│  ║                          ║  │
│  ║  👥 3 orang  ·  8 hari  ║  │
│  ║  🚂 Kereta · Travel · Grab║  │
│  ║                          ║  │
│  ║  ┌──────────┐            ║  │
│  ║  │ 8 hari lagi 🎉       │  ║  │  ← live countdown chip
│  ║  └──────────┘            ║  │
│  ║                          ║  │
│  ║  [Itinerary] [Hotel] [Budget]║  │  ← quick jump buttons
│  ╚══════════════════════════╝  │
│                                │
│  (future trips appear below)   │
└────────────────────────────────┘
```

**Interaction details:**
- Hero card has a subtle animated gradient shimmer on load
- Countdown chip updates in real-time; changes to "Hari ke-3 dari 8" during trip, "Selesai ✓" after
- Three jump buttons deep-link to `/trips/semarang-jogja#itinerary` etc.
- Status badge top-right: `Upcoming` (blue) / `On Trip` (green, pulsing dot) / `Selesai` (gray)

---

### Screen 2: Trip Detail Page `/trips/semarang-jogja`

#### 2a. Sticky Top Header
```
┌────────────────────────────────┐
│ ←  Semarang – Yogyakarta  📤  │  ← back + share (WA share whole trip)
│    [Itinerary][Hotel][Budget]  │  ← tab bar, sticky below header
└────────────────────────────────┘
```

- Tabs use existing `src/components/ui/tabs.tsx`
- Active tab underline slides smoothly between tabs (CSS transition)
- Header background: `bg-background/90 backdrop-blur-md` (same glass effect as app)

#### 2b. Tab 1 — Itinerary

**City Filter Chips** (below tabs, scroll-locked):
```
  [🟢 Semua] [🟢 Semarang] [🟣 Yogyakarta]
```
- Pill shape, `rounded-full`, `border`
- Active chip: filled bg in city color, white text
- Inactive: outlined, muted text
- Tapping a city chip animates the day selector strip to scroll to the first relevant day

**Day Selector Strip** (horizontal scroll, no scrollbar):
```
  [H1·Min] [H2·Sen] [H3·Sel] [H4·Rab] [H5·Kam] [H6·Jum] [H7·Sab] [H8·Min]
```
- Each chip: `48px × 56px`, rounded card, centered text
- Day number bold, weekday abbreviation smaller below
- Left-edge colored dot: green (Semarang), purple (Yogyakarta), split gradient (transit)
- Active chip: elevated shadow, primary color border
- Tapping scrolls main content to that day via `scrollIntoView({behavior: 'smooth'})`
- As user scrolls the main list, the active chip in the strip auto-updates (Intersection Observer)

**Day Card** (collapsible):
```
┌─────────────────────────────────┐
│ H1 · Minggu, 16 Agustus    🟢 ▼│  ← tap to collapse/expand
│ Kota Lama & Heritage Night      │  ← area subtitle
├─────────────────────────────────┤
│ ℹ️  Hotel → Kota Lama (4 km)   │  ← teal info banner (area_note)
├─────────────────────────────────┤
│ [schedule items...]             │
└─────────────────────────────────┘
```

**Schedule Item Row** (the core element):
```
┌──────────────────────────────────────────┐
│  09.00  🍜  Soto Bokoran          🗺️    │
│             Jl. Plampitan · Kota Lama    │
│             Buka 06.00–14.00             │
│             [HIGHLIGHT] [CASH ONLY]      │
└──────────────────────────────────────────┘
```

- **Left**: time chip — monospace, `text-xs`, muted, `w-12` fixed, right-aligned to create a rail
- **Middle**: type icon (Lucide, 16px, colored by `activity_type`) + name (bold if highlight) + location + notes
- **Right**: "🗺️" icon button → opens `maps_url` in new tab. `44×44px` tap target.
- Badges inline below name: `HIGHLIGHT` (yellow), `CASH ONLY` (red), `BOOK H-1` (orange), `Optional` (gray)
- Opening hours: `text-xs text-muted-foreground` below location
- Notes (if any): italic, truncated to 2 lines, "Lihat selengkapnya" expand tap

**Warning Banner** (when `warning_note` exists):
```
┌──────────────────────────────────────────┐
│ ⚠️  Hindari Simpang Lima & Jl. Pandanaran│
│     pagi (06.00–09.00) dan sore (16.00–  │
│     18.00) karena upacara HUT RI.        │
└──────────────────────────────────────────┘
```
- Amber background `hsl(38, 100%, 95%)`, dark amber text, rounded-xl
- Placed at top of its day card, above schedule items

**WhatsApp Share button** per day (bottom of each day card):
```
  [📤 Bagikan jadwal hari ini via WhatsApp]
```
- Outlined button, full-width, `text-sm`
- Uses `formatTripDayWhatsApp(day)` → native WA deep link

---

#### 2c. Tab 2 — Hotel

```
┌─────────────────────────────────────────┐
│ 🏨 Djajanti House                       │
│ Semarang · Check-in 16 Aug → 19 Aug     │
│                                         │
│ 📍 Jl. Semeru Raya No.4b, Karangrejo    │  ← tap to copy
│    Gajahmungkur, Semarang               │
│                           [Buka Maps →] │
│                                         │
│ Jarak ke area wisata:                   │
│ ┌───────────────────┬──────┬──────────┐ │
│ │ Simpang Lima      │ ±2km │ ~7 menit │ │
│ │ Kota Lama         │ ±4km │ ~10 menit│ │
│ │ Pantai Barat      │ ±12km│ ~25 menit│ │
│ └───────────────────┴──────┴──────────┘ │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🏨 Ndalem Cokro                         │
│ Yogyakarta · Check-in 19 Aug → 23 Aug   │
│ ...                                     │
└─────────────────────────────────────────┘
```

- Address has a 📋 copy-to-clipboard icon (toast: "Alamat disalin!")
- "Buka Maps →" button → external link, opens Google Maps
- Distance table: zebra striped, compact, `text-sm`
- Hotel card uses existing `bg-card border rounded-2xl` style

---

#### 2d. Tab 3 — Budget

```
┌─────────────────────────────────────────┐
│ Perkiraan Budget (3 Orang)              │
│                                         │
│ [Tampilkan penginapan ☑]               │  ← toggle switch
│                                         │
│ Kategori           Detail      Subtotal │
│ ─────────────────────────────────────── │
│ Akomodasi Semarang  3 malam   Rp2.850rb │
│ Akomodasi Yogya     4 malam   Rp3.200rb │
│ Travel Semarang→Jogja 3 org   Rp  300rb │
│ Transport lokal     8 hari    Rp  810rb │
│ Makan & kuliner                Rp3.525rb │
│ Tiket wisata                   Rp  810rb │
│ Oleh-oleh                      Rp1.050rb │
│ ─────────────────────────────────────── │
│ Total (di luar akomoda...)    Rp6.495rb │
│ ─────────────────────────────────────── │
│                                         │
│   👤 Per Orang (termasuk akomoda)      │
│   ┌─────────────────────────────────┐  │
│   │   Rp 4.841.667                  │  │  ← prominent callout
│   └─────────────────────────────────┘  │
│                                         │
│  [Bagikan estimasi via WhatsApp]        │
└─────────────────────────────────────────┘
```

- Toggle "Tampilkan penginapan" hides/shows accommodation rows and recalculates totals
- Per-person callout: large `text-2xl font-bold`, primary color, rounded card
- `formatRupiah()` from `src/lib/utils.ts` on all amounts
- Rows with `amount_rp = 0` render as `—` (variable/TBD)
- WhatsApp share button: formats budget summary as text message

---

### HomeHub Integration

```
┌─────────────────────────────────────────┐
│ [🍽️ Makan Bareng] [🏃 Aktivitas Seru]  │  ← existing cards
│ [🎁 Gift Pooling]  [🥗 Bekal Sehat]    │  ← existing cards
│ [🗺️ Perjalanan ]                        │  ← NEW — full-width below grid
└─────────────────────────────────────────┘
```

The "Perjalanan" card is placed **below the 2×2 grid** as a full-width card (not a third column), to avoid squishing the existing layout. It has a distinctive horizontal gradient banner style:

```
┌────────────────────────────────────────┐
│ 🗺️  Perjalanan                 [8 hari lagi]
│     Semarang – Yogyakarta              │
│     16–23 Agustus 2026 · 3 orang      │
│     ████████████░░░░░░░░  progress bar │  ← trip timeline progress
└────────────────────────────────────────┘
```

- `className="col-span-2"` to span both grid columns
- Gradient left-to-right: Semarang green → Yogyakarta purple
- Progress bar shows where today falls in the trip duration
- Countdown chip dynamically computed from `start_date`

---

### Motion & Micro-Interactions

| Interaction | Animation |
|---|---|
| Day card expand/collapse | `max-height` transition 200ms ease-out |
| Day chip active change | slide underline 150ms |
| City filter chip tap | scale 0.95 → 1.0, 100ms |
| Maps button tap | ripple effect, 150ms |
| Schedule item expand notes | fade-in 150ms |
| Tab switch | content fade 100ms |
| Badge copy-to-clipboard | toast slide-in from top 200ms |

---

## Part 6: New Files Summary

### Backend (4 files)

| File | Type | Purpose |
|---|---|---|
| [`server/db.js`](file:///z:/home/yoshiafk/personal-project/semeja/server/db.js) | MODIFY | Add 6 new table `CREATE TABLE IF NOT EXISTS` blocks |
| [NEW] `server/routes/trips.js` | NEW | REST CRUD for trips |
| [NEW] `server/scripts/seed-trip-semarang-jogja.js` | NEW | One-off seed from itinerary MD data |
| [`server/app.js`](file:///z:/home/yoshiafk/personal-project/semeja/server/app.js) | MODIFY | Register `/api/trips` route |

### Frontend (12 files)

| File | Type | Purpose |
|---|---|---|
| [NEW] `src/types/trip.ts` | NEW | Shared TypeScript types |
| [`src/lib/api.ts`](file:///z:/home/yoshiafk/personal-project/semeja/src/lib/api.ts) | MODIFY | Add `getTrips`, `getTripDetail` |
| [`src/lib/whatsapp.ts`](file:///z:/home/yoshiafk/personal-project/semeja/src/lib/whatsapp.ts) | MODIFY | Add `formatTripDayWhatsApp`, `formatTripBudgetWhatsApp` |
| [NEW] `src/components/TripCountdownBanner.tsx` | NEW | Live countdown / status chip |
| [NEW] `src/components/TripDayCard.tsx` | NEW | Collapsible day card with banners |
| [NEW] `src/components/TripScheduleItem.tsx` | NEW | Single timeline row |
| [NEW] `src/components/TripHotelCard.tsx` | NEW | Hotel card + distance table |
| [NEW] `src/components/TripBudgetTable.tsx` | NEW | Budget rows + per-person + toggle |
| [NEW] `src/components/TripDaySelector.tsx` | NEW | Horizontal scrolling day chip strip |
| [NEW] `src/pages/trips/index.tsx` | NEW | `/trips` — trip list |
| [NEW] `src/pages/trips/detail.tsx` | NEW | `/trips/:slug` — tabbed detail |
| [`src/pages/HomeHub.tsx`](file:///z:/home/yoshiafk/personal-project/semeja/src/pages/HomeHub.tsx) | MODIFY | Add full-width Perjalanan card |
| [`src/App.tsx`](file:///z:/home/yoshiafk/personal-project/semeja/src/App.tsx) | MODIFY | Add lazy routes for /trips and /trips/:slug |

---

## Part 7: Delivery Phases

### ✅ Phase 1 — MVP
1. DB schema additions to `initDB()` + seed script
2. `server/routes/trips.js` (GET list + GET detail)
3. `src/types/trip.ts` + API client additions
4. All 5 new components
5. `/trips` list page + `/trips/:slug` detail page (Itinerary + Hotel + Budget tabs)
6. HomeHub full-width card + App.tsx routes
7. WhatsApp share for day summary

### 🔮 Phase 2 — V2 Stretch
| Feature | Effort | Value |
|---|---|---|
| Packing checklist tab (localStorage) | Low | High |
| "Today" auto-scroll to current day | Low | High |
| Admin trip creation form (POST /trips) | Medium | Medium |
| Embedded map iframe view | Medium | High |
| Trip cover photo / image upload | Medium | Medium |

---

## Part 8: Verification Plan

### Build
```bash
tsc --noEmit   # TypeScript clean
npm run build  # Vite build succeeds
```

### Manual Mobile Testing (Chrome DevTools → iPhone 14 / 390px)
1. HomeHub → "Perjalanan" full-width card shows with countdown and gradient
2. Tap card → `/trips` renders, hero card with gradient + countdown chip
3. Tap "Itinerary" → Day selector strip scrolls horizontally, all 8 chips visible
4. Tap H2 chip → scrolls to Day 2 card; amber warning banner visible for HUT RI alert
5. Expand Day 2 → Lawang Sewu item shows "Buka Maps" → correct Maps URL opens
6. Raminten Cabaret (H6) shows `BOOK H-1` badge
7. Ayam Goreng Pak Supar (H2) shows `CASH ONLY` badge
8. Tap "Hotel" tab → both hotels render; address tap copies to clipboard (toast confirms)
9. "Ndalem Cokro → Buka Maps" opens correct Google Maps link
10. Tap "Budget" tab → all 7 rows + per-person callout; toggle removes accommodation rows
11. Day WhatsApp share → pre-filled message with correct day schedule opens WA
12. Bottom tab bar not obscured on any screen

### Server
```bash
node server/scripts/seed-trip-semarang-jogja.js  # runs without errors
curl /api/trips                                   # returns trip list
curl /api/trips/semarang-jogja-2026               # returns full detail
```

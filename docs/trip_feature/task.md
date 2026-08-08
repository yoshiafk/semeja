# Travel Plans Module — Task Tracker

## Phase 1: Backend — DB Schema
- [x] Add 6 new tables to `server/db.js` initDB()
- [x] Add indexes for new tables

## Phase 2: Backend — Seed Script
- [x] Create `server/scripts/seed-trip-semarang-jogja.js` (all 55+ items from MD)

## Phase 3: Backend — REST API
- [x] Create `server/routes/trips.js` (GET list, GET by slug)
- [x] Register route in `server/app.js`

## Phase 4: Frontend — Types & API Client
- [x] Create `src/types/trip.ts`
- [x] Add `getTrips`, `getTripDetail` to `src/lib/api.ts`
- [x] Add `formatTripDayWhatsApp`, `formatTripBudgetWhatsApp` to `src/lib/whatsapp.ts`

## Phase 5: Frontend — Components
- [x] Create `src/components/TripCountdownBanner.tsx`
- [x] Create `src/components/TripDaySelector.tsx`
- [x] Create `src/components/TripScheduleItem.tsx`
- [x] Create `src/components/TripDayCard.tsx`
- [x] Create `src/components/TripHotelCard.tsx`
- [x] Create `src/components/TripBudgetTable.tsx`

## Phase 6: Frontend — Pages
- [x] Create `src/pages/trips/index.tsx` (trip list)
- [x] Create `src/pages/trips/detail.tsx` (tabbed detail)

## Phase 7: Frontend — Wiring
- [x] Modify `src/App.tsx` (add routes)
- [x] Modify `src/pages/HomeHub.tsx` (add full-width Perjalanan card)

## Phase 8: Verification
- [ ] TypeScript check (no errors)
- [ ] Seed script runs cleanly
- [ ] All tabs render, Maps links correct

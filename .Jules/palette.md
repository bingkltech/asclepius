## YYYY-MM-DD - Initializing Palette\n**Learning:** Palette agent initialized.\n**Action:** Start discovering UX opportunities.

## $(date +%Y-%m-%d) - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found a recurring pattern across the app (Sidebar toggle, AgentCard pause/terminate) where icon-only action buttons lacked `aria-label` attributes, making them inaccessible to screen readers.
**Action:** Always verify that buttons containing only an icon component (like `<Trash2 />` or `<ChevronLeft />`) have a descriptive `aria-label`.

## 2026-04-18 - Flexible UI Components and Dialogs
**Learning:** Native CSS 'resize: both' works perfectly on complex React UI components (like DialogContent) when rigid width/height limits (e.g. w-[800px] h-[600px]) are removed. However, to maintain a good default experience without Javascript, it's essential to keep reasonable min-width and min-height constraints so the UI doesn't collapse below readable thresholds.
**Action:** Always favor flexible, constraint-based sizing (min/max dimensions) over rigid pixel/rem values when designing floating components like dialogs or panels.

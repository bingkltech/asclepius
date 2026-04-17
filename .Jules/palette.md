## YYYY-MM-DD - Initializing Palette\n**Learning:** Palette agent initialized.\n**Action:** Start discovering UX opportunities.

## $(date +%Y-%m-%d) - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found a recurring pattern across the app (Sidebar toggle, AgentCard pause/terminate) where icon-only action buttons lacked `aria-label` attributes, making them inaccessible to screen readers.
**Action:** Always verify that buttons containing only an icon component (like `<Trash2 />` or `<ChevronLeft />`) have a descriptive `aria-label`.

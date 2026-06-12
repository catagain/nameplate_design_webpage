# Ultrawork Notepad — Nameplate UX Overhaul
Started: 2026-06-04T...

## Plan (Wave-based)
- Wave 1: Tab-based Sidebar Refactor (Foundation)
- Wave 2: Google Sheets-style Color Picker (UI/UX)
- Wave 3: Global Feedback System (Toast/Progress)
- Wave 4: Onboarding & Template Expansion (Polishing)

## Scenarios (The Contract)
### S1: Tab Navigation
- **Happy Path**: Click 'Object Editing' Tab $\rightarrow$ only object-related sections are visible.
- **Edge Case**: Tab switch while a section is internally 'hidden' $\rightarrow$ it remains hidden.
- **Verification**: Chrome DevTools $\rightarrow$ check display: none on non-active tab sections.

### S2: Color Variations
- **Happy Path**: Select 'Deep Blue' $\rightarrow$ variation grid shows 10 shades of blue (light to dark).
- **Edge Case**: Select 'White' $\rightarrow$ variations are correctly calculated as gray/off-white.
- **Verification**: Screenshot of color grid $\rightarrow$ verify HSL lightness steps.

### S3: API Feedback
- **Happy Path**: Trigger 'Update Device' $\rightarrow$ Toast 'Updating...' appears $\rightarrow$ turns into 'Success'.
- **Edge Case**: Network error $\rightarrow$ Toast turns 'Error: Network Failed' in red.
- **Verification**: Network Tab (Simulate Offline) $\rightarrow$ verify Toast color and message.

## Now
- Wave 1: Implementing Tab-based Sidebar Layout.

## Todo
- [ ] HTML: Add Tab Navigation to .edit-panel
- [ ] CSS: Implement Tab styles and transition
- [ ] JS: Implement tab switching logic (initTabs)
- [ ] QA: Verify S1 (Tab Navigation)
- [ ] Implement Wave 2 (Color Menu)
- [ ] Implement Wave 3 (Feedback)
- [ ] Implement Wave 4 (Onboarding/Templates)

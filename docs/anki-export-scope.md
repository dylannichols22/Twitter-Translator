# Scope: Export Saved Cards to Anki Deck

## Goal
Allow users to export their saved translation cards into Anki, either as a new deck or by appending to an existing deck, without disrupting existing review progress.

## Non-Goals
- No full Anki sync client implementation (use file export/import).
- No scheduled background sync.
- No AnkiWeb auth.
- No editing of existing Anki notes after export (v1).

## User Stories
- As a user, I can export all saved cards to a new Anki deck (.apkg).
- As a user, I can export saved cards to an existing Anki deck without losing or resetting progress.
- As a user, I can choose which cards to export (all, selected, or filtered by tag/source).
- As a user, I can avoid duplicate cards when exporting to an existing deck.

## UX Surface
- Saved cards page: add “Export to Anki…” CTA.
- Export dialog:
  - Deck target: `New deck` or `Existing deck`.
  - If New: enter deck name.
  - If Existing: choose deck name from a text input and optional “import into existing deck” instructions.
  - Export selection: All / Selected / Filtered.
  - Include audio? (future) placeholder toggle.
  - Duplicate handling: skip if already exported (default), or allow duplicates.
  - Summary: number of cards and size estimate.

## Data Model
Each saved card should map to an Anki note with:
- Front: Original Chinese text
- Back: Translation
- Optional fields: tweet metadata (author, date, link), tags, notes
- Tags: `twitter-translator`, user tags, source (tweet ID), export batch ID

Add a stable card identifier to saved cards if not already present:
- `cardId`: stable UUID, generated at save time.
- `sourceId`: original tweet ID or hash of text.

## Export Format
- Use Anki `.apkg` with a dedicated model.
- Model name: `TwitterTranslatorCard`.
- Fields: `Front`, `Back`, `Source`, `Notes`.
- CSS template for readability, including Chinese font fallback.

## Existing Deck Preservation
Anki progress is tied to notes and cards already present in a collection. To avoid resetting progress:
- Do **not** delete or reimport the deck database.
- Export as an `.apkg` that **adds** notes only.
- Ensure note uniqueness so we don’t create duplicates or overwrite:
  - Use a deterministic `guid` based on `cardId` or `sourceId` hash.
  - When importing into existing deck, Anki will skip or update based on GUID. Use “skip duplicates” by default.
- Do not alter note type or field order for existing notes.

## Export Pipeline (Proposed)
1. Read saved cards from storage.
2. Normalize fields and generate note GUIDs.
3. Create Anki package:
   - `collection.anki2` with note + card rows.
   - media bundle for images (v1: none).
4. Download `.apkg` to user.
5. Provide in-app import instructions:
   - If importing into existing deck, choose “Add” and “Update existing notes” off (default Anki import).

## Edge Cases
- Duplicate cards across exports -> detected via GUID or sourceId.
- User chooses existing deck name that doesn’t exist -> Anki will create it on import; clarify in UI.
- Deck name collisions -> Anki merges into existing deck, no data loss.
- Large exports -> chunking or progress indicator.
- Missing translations -> skip or include with placeholder.

## Telemetry (Optional)
- Track export count and export size (no content).

## Implementation Notes
- Use a lightweight `.apkg` generator library or implement minimal format.
- Ensure deterministic GUID generation.
- Add unit tests:
  - GUID stability across exports.
  - Duplicate handling.
  - New deck export metadata.

## Open Questions
- Do we need to support multiple note types?
- Should we include pronunciation or audio?
- Should exports be limited to last N cards?

## Success Criteria
- Export produces an `.apkg` that imports into Anki.
- Import into existing deck does not reset scheduling for existing cards.
- Duplicate exports do not create duplicate notes (default).

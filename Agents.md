# Agent Instructions

## Project Overview

Firefox browser extension for translating Chinese Twitter/X content using Claude API.
See REQUIREMENTS.md for full specification.

## Development Approach

This project uses **Test-Driven Development (TDD)**:
1. Read REQUIREMENTS.md to understand what needs to be built
2. Find the next unimplemented requirement
3. Write a failing test for that requirement
4. Implement minimal code to make the test pass
5. Refactor if needed
6. Commit with a descriptive message
7. Repeat until all requirements have tests and pass

## Commands

### Validate (run all checks)
```bash
npm run validate
```

### Test
```bash
npm test
```

### Type Check
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

### Build
```bash
npm run build
```

## Project Structure

```
src/
  background.ts      # Extension background script
  content.ts         # Content script for Twitter pages
  popup/             # Extension popup UI
  translator/        # Claude API integration
  scraper/           # Twitter DOM scraping
  storage/           # Settings and cache management
  cost/              # Usage tracking
  ui/                # Translation view (new tab)
  *.test.ts          # Tests alongside source files
```

## Completion Criteria

The loop is complete when:
1. All requirements from REQUIREMENTS.md have corresponding tests
2. All tests pass (`npm test` exits with code 0)
3. Type checking passes (`npm run typecheck` exits with code 0)
4. Linting passes (`npm run lint` exits with code 0)
5. Build succeeds (`npm run build` exits with code 0)

## Key Technical Notes

- Firefox Manifest V3 extension
- TypeScript with strict mode
- Vitest for testing with happy-dom for DOM simulation
- Claude API for translations (user provides API key)
- Use `data-testid` attributes for Twitter DOM scraping (more stable than classes)
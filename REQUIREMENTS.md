# Twitter Chinese Translator - Firefox Extension

## Overview

A Firefox browser extension for translating Chinese social media content with AI, designed as a learning tool for Chinese language and culture. Initial focus is Twitter/X.

## Activation Methods

### 1. Context Menu
- User right-clicks anywhere on a Twitter page
- Select "Translate Chinese Content" from context menu

### 2. Extension Popup
- User clicks extension icon in toolbar
- Select translate option from popup menu

## Translation View

When activated, the extension opens a **new tab** containing the translated content.

### Thread Display

Each comment/post in the thread displays:
- Original Chinese text (preserved)
- Natural English translation directly above or below the original
- Visual separation between comments maintained

```
┌─────────────────────────────────────────┐
│ [Natural English translation]           │
│ [Original Chinese text]                 │
├─────────────────────────────────────────┤
│ [Natural English translation]           │
│ [Original Chinese text]                 │
└─────────────────────────────────────────┘
```

## Detailed Post Breakdown

When a user **clicks on any post**, expand to show a detailed linguistic breakdown.

### Segmentation Table

Break the text into natural subsegments of a few characters each. Segmentation should reflect how a native speaker would parse the sentence (meaningful units, not arbitrary splits).

| Subsegment | 今天 | 天气 | 真的 | 很好 |
|------------|------|------|------|------|
| **Pinyin** | jīntiān | tiānqì | zhēnde | hěn hǎo |
| **Gloss** | today | weather | really | very good |

For longer posts, use multiple tables to maintain readability.

### Table Structure

| Row | Content |
|-----|---------|
| 1 | Chinese subsegment (original characters) |
| 2 | Pinyin with tone marks |
| 3 | Interlinear gloss (word-by-word meaning) |

### Notes Section

Below the breakdown table(s), include a **Notes** section containing:

- **Cultural context**: References to Chinese culture, history, memes, or social context
- **Internet culture**: Slang, abbreviations, platform-specific language, trending phrases
- **Linguistic notes**: Interesting grammar patterns, idioms (成语), colloquialisms
- **Learning tips**: Anything valuable for a Chinese language learner

## Example Full Breakdown

**Original:** 今天天气真的很好，适合出去玩！

**Translation:** The weather is really nice today, perfect for going out!

| 今天 | 天气 | 真的 | 很好 |
|------|------|------|------|
| jīntiān | tiānqì | zhēnde | hěn hǎo |
| today | weather | really | very-good |

| 适合 | 出去 | 玩 |
|------|------|-----|
| shìhé | chūqù | wán |
| suitable-for | go-out | play/have-fun |

**Notes:**
- 玩 (wán) literally means "play" but is commonly used for any leisure activity or hanging out
- This sentence structure (statement + 适合 + activity) is a common pattern for making suggestions

## Technical Requirements

### Platform
- Firefox browser extension (Manifest V3)
- Twitter/X support initially

### Data Extraction (No Twitter API)

Twitter API is prohibitively expensive. Instead, extract content directly from the rendered page:

- Parse DOM to extract tweet content, author, timestamp, structure
- Preserve thread hierarchy and formatting
- **Scope limitation**: Only translate the main thread (original post + direct replies)
- Do NOT expand or translate nested comments (replies to replies)
- **Quote tweets**: If OP is a quote tweet, only translate the OP's text, ignore the quoted content
- **Comment limit**: Only translate top X comments (X is configurable in settings, default TBD)
- Future consideration: Optional setting to include nested comments

#### Scraping Strategy

Twitter's DOM structure changes frequently. Approach:
- Use semantic selectors where possible (aria-labels, data-testid attributes)
- Twitter uses `data-testid` attributes that are more stable than class names
- Key selectors to identify: tweet containers, tweet text, author info, timestamp, thread structure
- May need periodic maintenance when Twitter updates their frontend

### AI Integration

**Bring Your Own Key (BYOK)**
- User provides their own API key
- Initially support **Claude** (Anthropic API)
- Key stored securely in extension storage
- Future: Support for additional providers (OpenAI, etc.)

**Translation Quality**
- Natural translation quality (not literal/robotic)
- Intelligent text segmentation
- Cultural/linguistic annotation generation

### Cost Tracking

Track and display AI API usage costs:

| Metric | Description |
|--------|-------------|
| **This Week** | Cost from Monday 00:00 to now |
| **This Month** | Cost from 1st of month to now |
| **All Time** | Total cumulative cost |

Implementation:
- **Pre-translation estimate**: Show estimated cost before translating a thread (helps during testing)
- Log each API call with token count and estimated cost
- Store usage history in extension local storage
- Display in extension popup or settings page
- Calculate costs based on current Claude API pricing

### Caching

- Cache translations for the duration of the browser session
- Avoid re-translating identical content within same session
- Cache invalidates on browser restart (simple approach)

### UI/UX

Keep it simple - this is a prototype. We can iterate.

- Clean, readable translation view
- Settings page for: API key, comment limit (X), usage stats
- Pinyin display: use diacritics/tone marks (e.g., jīntiān), not numbers

### Privacy

Personal app - bare minimum:
- Note in settings that tweet content is sent to Anthropic API for translation

## Out of Scope (Prototype)

Not implementing for now:
- Language detection/skipping (user decides what to translate)
- Dark mode / theme matching
- Keyboard shortcuts
- Export/save functionality
- Accessibility features
- Multiple AI providers

## Future Considerations

If this prototype works well:
- Support for additional Chinese social media platforms (Weibo, Xiaohongshu, Douyin)
- Additional AI providers (OpenAI, Gemini, local models)
- Skip non-Chinese content (token saving)
- Include quoted tweet content
- Optional nested comment translation
- Vocabulary saving/export

# PhotoLingo Japanese Literacy System Design

A comprehensive redesign to transform PhotoLingo from a vocabulary app into a true Japanese literacy tool.

---

## 1. Core Philosophy

**The Problem**: Users memorize "猫 = cat" but can't actually read 猫 when they see it in the wild. Romaji becomes a crutch that prevents true literacy.

**The Solution**: Every interaction should build toward reading Japanese script directly. Romaji is a bridge, not a destination.

---

## 2. Japanese Writing System Support

### Scripts Handled

| Script | Description | Example | Usage |
|--------|-------------|---------|-------|
| **Hiragana** | 46 basic characters | あいう | Native Japanese words, grammar |
| **Katakana** | 46 characters | アイウ | Foreign loanwords, emphasis |
| **Kanji** | 2000+ common | 猫, 食べる | Meaning-carrying characters |
| **Furigana** | Reading hints | <ruby>猫<rt>ねこ</rt></ruby> | Pronunciation guide above kanji |

### New Data Model

```typescript
interface Word {
  // Core representations
  japanese: string;      // "猫" - written form
  reading: string;       // "ねこ" - hiragana reading
  romaji: string;        // "neko" - romanization
  english: string;       // "cat" - meaning

  // Script analysis
  scriptType?: 'hiragana' | 'katakana' | 'kanji' | 'mixed';
  containsKanji?: boolean;
  furigana?: FuriganaSegment[];

  // Separate mastery tracking
  mastery: MasteryLevel;        // meaning mastery
  masteryScore: number;
  readingMastery?: MasteryLevel; // reading mastery (NEW)
  readingScore?: number;
}

interface Sentence {
  japanese: string;      // Full sentence
  reading: string;       // Hiragana reading
  romaji: string;        // Romanization
  translation: string;   // English
  furigana: FuriganaSegment[];
  wordIds: string[];     // Links to vocabulary
  readingMastery: number;
}
```

---

## 3. User Progression System

### Reading Levels

| Level | Name | Description | Furigana | Romaji |
|-------|------|-------------|----------|--------|
| 0 | **Romaji Reader** | Just starting | Always shown | Primary display |
| 1 | **Kana Learner** | Learning あ-ん | Always shown | Secondary |
| 2 | **Kana Reader** | Comfortable with kana | Always shown | Hidden by default |
| 3 | **Kanji Beginner** | Learning first kanji | Always shown | Never |
| 4 | **Kanji Reader** | Growing kanji knowledge | On-tap reveal | Never |
| 5 | **Fluent Reader** | Comfortable reading | Rarely shown | Never |

### Progression Triggers

- **Kana → Kanji**: When user knows 46+ hiragana
- **Kanji-basic → Kanji-read**: When user knows 50+ kanji
- **Auto-advance**: Can be enabled in settings

---

## 4. Redesigned Lesson Flow

```
PHOTO CAPTURED
     │
     ▼
┌────────────────────────────────────────┐
│          AI EXTRACTION                  │
│  • 5-8 vocabulary words                 │
│  • 1-2 contextual sentences             │
│  • Script analysis (kanji/kana/mixed)   │
│  • Furigana data for all kanji          │
└────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│       PHASE 1: WORD DISCOVERY           │
│  • Words float over photo               │
│  • Script badges visible (漢, ひ, カ)   │
│  • Furigana shown per user level        │
│  • Tap word → detailed reading card     │
└────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│       PHASE 2: READING FOCUS            │
│  • Each word gets a "reading moment"    │
│  • User sees: script → audio → reading  │
│  • Script type explained                │
│  • Furigana interactive (tap reveal)    │
└────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│       PHASE 3: SENTENCE CONTEXT         │
│  • Sentence using learned vocabulary    │
│  • Full furigana support                │
│  • Audio: full + word-by-word           │
│  • Translation toggle                   │
└────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│       PHASE 4: PRACTICE                 │
│  • Speaking (existing)                  │
│  • Meaning quiz (existing)              │
│  • Reading quiz (NEW)                   │
│  • Sentence comprehension (NEW)         │
└────────────────────────────────────────┘
```

---

## 5. UI Components

### New Components Created

1. **FuriganaText** (`src/components/FuriganaText.tsx`)
   - Renders Japanese with furigana above kanji
   - Supports tap-to-reveal mode
   - Adapts to user's reading level

2. **WordCard** (`src/components/WordCard.tsx`)
   - Enhanced word display with script badges
   - Shows both meaning and reading mastery
   - Three variants: compact, full, quiz

3. **SentenceCard** (`src/components/SentenceCard.tsx`)
   - Full sentence with furigana
   - Audio controls (normal/slow)
   - Translation toggle
   - Reading mode switcher

4. **ScriptBadge**
   - Visual indicator: ひ (hiragana), カ (katakana), 漢 (kanji)
   - Color-coded by type

5. **ReadingModeToggle**
   - Switch between: 振り仮名 / 漢字 / Romaji

---

## 6. Reading-Focused Quiz Types

### New Quiz Types

| Type | Description | Example |
|------|-------------|---------|
| `kanji-to-reading` | See kanji, pick hiragana | 猫 → [ねこ, いぬ, とり, さかな] |
| `reading-to-kanji` | See reading, pick kanji | ねこ → [猫, 犬, 鳥, 魚] |
| `audio-to-script` | Hear word, pick written form | 🔊 → [猫, 犬, 鳥, 魚] |
| `kana-recognition` | See kana, pick romaji | ね → [ne, nu, na, no] |
| `script-type` | Identify script type | コーヒー → [Katakana] |
| `sentence-reading` | Read sentence, comprehension | Full sentence quiz |
| `furigana-fill` | Fill in missing reading | 猫(___) → type ねこ |

### Quiz Distribution by Level

```
Romaji Reader:    10% kanji, 50% kana, 30% audio, 10% script
Kana Learner:     30% kanji, 30% kana, 30% audio, 10% script
Kanji Beginner:   50% kanji, 20% kana, 20% audio, 10% script
Kanji Reader:     60% kanji, 10% kana, 20% audio, 10% script
Fluent Reader:    70% kanji, 5% kana, 20% audio, 5% script
```

---

## 7. Spaced Repetition for Reading

### Separate Tracking

Words now track two types of mastery:
- **Meaning mastery**: "Do you know what this means?"
- **Reading mastery**: "Can you read this Japanese?"

### Review Triggers

A word enters reading review when:
1. `readingScore < 90` AND
2. (`nextReadingReview <= today` OR never reviewed)

### Interval Progression

```
Correct: 1 → 3 → 7 → 14 → 30 days
Wrong:   Reset to 1 day
```

---

## 8. AI Service Enhancements

The AI now extracts:

```json
{
  "location": "your kitchen",
  "words": [
    {
      "japanese": "猫",
      "reading": "ねこ",
      "romaji": "neko",
      "english": "cat",
      "partOfSpeech": "noun"
    }
  ],
  "sentences": [
    {
      "japanese": "猫がテーブルの上にいます",
      "reading": "ねこがてーぶるのうえにいます",
      "romaji": "neko ga teeburu no ue ni imasu",
      "english": "The cat is on the table",
      "context": "describing location"
    }
  ]
}
```

---

## 9. Implementation Status

### Completed

- [x] Updated type definitions with reading support
- [x] FuriganaText component
- [x] WordCard component with reading modes
- [x] SentenceCard component
- [x] Japanese text analysis utilities
- [x] Reading quiz generator
- [x] Enhanced AI service with sentence generation
- [x] User reading progress tracking types

### Next Steps

1. **Update Learn Screen**
   - Integrate FuriganaText into word bubbles
   - Add sentence display phase
   - Show script badges

2. **Update Quiz Screen**
   - Add reading quiz modes
   - Handle kanji-to-reading questions
   - Audio playback for audio-to-script

3. **Add Kana Training**
   - Dedicated hiragana/katakana practice
   - Progress tracking per character
   - Achievement milestones

4. **Settings Screen**
   - Reading level selection
   - Furigana preferences
   - Romaji toggle

5. **Review System**
   - Separate reading review queue
   - Combined review option

---

## 10. Future: Writing Support

### Phase 1: Tracing (Later)
- Show stroke order animations
- Finger tracing practice
- Correctness feedback

### Phase 2: Free Writing (Much Later)
- Write from memory
- Handwriting recognition
- Stroke order grading

---

## 11. File Structure

```
src/
├── components/
│   ├── FuriganaText.tsx    # NEW - Furigana renderer
│   ├── WordCard.tsx        # NEW - Enhanced word display
│   └── SentenceCard.tsx    # NEW - Sentence display
├── utils/
│   ├── japaneseText.ts     # NEW - Script analysis
│   ├── readingQuiz.ts      # NEW - Quiz generator
│   └── speechRecognition.ts
├── services/
│   └── aiService.ts        # UPDATED - Sentence generation
├── types/
│   └── index.ts            # UPDATED - Reading types
└── store/
    └── index.ts            # UPDATED - Reading progress
```

---

## 12. XP Rewards

| Action | XP | Notes |
|--------|-----|-------|
| Learn word | 10 | Existing |
| Quiz correct (meaning) | 10 | Existing |
| Quiz correct (reading) | 15 | Higher for reading |
| Recognize kanji | 20 | Kanji is harder |
| Read sentence | 25 | Full comprehension |
| Learn kana character | 5 | Per character |

---

## Summary

This redesign transforms PhotoLingo from a vocabulary memorization tool into a comprehensive Japanese literacy application. Users will:

1. **See** Japanese text with appropriate reading support
2. **Hear** pronunciation with audio playback
3. **Read** with progressively less assistance
4. **Practice** with reading-specific quizzes
5. **Review** both meaning and reading separately

The goal: users who can actually READ Japanese, not just recognize translations.

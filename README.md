# PhotoLingo

A language learning app that turns your photos into interactive Japanese vocabulary lessons and Mad Libs-style stories.

## Features

- **Photo Analysis**: Take or upload photos and AI identifies objects with Japanese vocabulary
- **Vocabulary Labels**: Interactive labels overlay on photos with word type color coding
- **Language Toggle**: Switch between Japanese and English with romaji support
- **Story Generation**: AI creates Mad Libs-style stories using vocabulary from your photos
- **Genre Selection**: Mystery, Romance, Comedy, Horror, Sci-Fi, or Fairy Tale
- **Difficulty Levels**: 5 levels from Beginner to Expert
- **Word Bank**: Track learned vocabulary with accuracy stats
- **Progress Tracking**: XP, levels, and daily streaks

## Tech Stack

- React Native with Expo
- TypeScript
- NativeWind (Tailwind CSS)
- Expo Router (file-based navigation)
- Zustand (state management)
- Claude API (AI-powered photo analysis and story generation)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your API key:
```bash
cp .env.example .env
# Edit .env and add your Anthropic API key
```

3. Start the development server:
```bash
npm start
```

4. Run on your device:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your phone

## Project Structure

```
photolingo/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Capture screen
│   │   ├── stories.tsx    # Stories list
│   │   ├── vocabulary.tsx # Word bank
│   │   └── profile.tsx    # User profile
│   ├── photo-analysis.tsx # Photo analysis screen
│   └── story.tsx          # Story interaction screen
├── src/
│   ├── components/        # Reusable components
│   ├── constants/         # App constants
│   ├── hooks/             # Custom hooks
│   ├── services/          # API services
│   ├── store/             # Zustand store
│   ├── types/             # TypeScript types
│   └── utils/             # Helper functions
└── assets/                # Images, fonts, etc.
```

## Language Learning Principles

PhotoLingo incorporates proven language learning techniques:

1. **Contextual Learning**: Personal photos create memorable associations
2. **Comprehensible Input**: Stories adjusted to learner's level
3. **Active Recall**: Fill-in-the-blank exercises
4. **Spaced Repetition**: Vocabulary resurfaces in future stories
5. **Emotional Connection**: Personal photos strengthen memory
6. **Multimodal Learning**: Visual + text reinforcement

## License

MIT

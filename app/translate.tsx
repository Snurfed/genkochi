import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../src/constants/design';
import { useAppStore } from '../src/store';
import { speakJapanese } from '../src/utils/speech';
import { XPPopup } from '../src/components/XPPopup';
import OpenAI from 'openai';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const openai = new OpenAI({
  apiKey: API_BASE_URL ? 'proxy' : (process.env.EXPO_PUBLIC_OPENAI_API_KEY || ''),
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : undefined,
  dangerouslyAllowBrowser: true,
});

type TranslationDirection = 'en-to-ja' | 'ja-to-en';

interface WordBreakdown {
  word: string;
  reading: string;
  meaning: string;
}

interface TranslationResult {
  translation: string;
  reading?: string;
  romaji?: string;
  breakdown?: WordBreakdown[];
}

export default function TranslateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const {
    saveTranslation,
    savedTranslations,
    translationFolders,
    cacheTranslation,
    getCachedTranslation,
    addXP,
  } = useAppStore();

  const [inputText, setInputText] = useState('');
  const [direction, setDirection] = useState<TranslationDirection>('en-to-ja');
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showXP, setShowXP] = useState(false);
  const [xpAmount, setXpAmount] = useState(0);
  const [isPracticing, setIsPracticing] = useState(false);

  const resultAnim = useRef(new Animated.Value(0)).current;
  const practiceAnim = useRef(new Animated.Value(0)).current;

  // Animate result appearance
  useEffect(() => {
    if (result) {
      resultAnim.setValue(0);
      Animated.spring(resultAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [result]);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    // Check cache first
    const cacheKey = `${direction}:${inputText.toLowerCase().trim()}`;
    const cached = getCachedTranslation(cacheKey);
    if (cached) {
      setResult({
        translation: cached.result,
        reading: cached.reading,
        romaji: cached.romaji,
      });
      setIsSaved(false);
      return;
    }

    setIsTranslating(true);
    setResult(null);
    setIsSaved(false);

    try {
      const isToJapanese = direction === 'en-to-ja';
      const prompt = isToJapanese
        ? `Translate this English to Japanese. Provide:
1. Japanese translation (natural, using appropriate kanji/kana)
2. Reading in hiragana
3. Romaji
4. Word breakdown (each word with reading and meaning)

Text: "${inputText}"

Respond in JSON:
{"translation": "日本語", "reading": "にほんご", "romaji": "nihongo", "breakdown": [{"word": "日本語", "reading": "にほんご", "meaning": "Japanese"}]}`
        : `Translate this Japanese to natural English.

Text: "${inputText}"

Respond in JSON:
{"translation": "English translation"}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a Japanese-English translator. Respond with valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Invalid response');

      const parsed = JSON.parse(jsonMatch[0]);
      const translationResult: TranslationResult = {
        translation: parsed.translation,
        reading: parsed.reading,
        romaji: parsed.romaji,
        breakdown: parsed.breakdown,
      };

      setResult(translationResult);

      // Cache result
      cacheTranslation(cacheKey, translationResult.translation, translationResult.reading, translationResult.romaji);

      // Award XP
      setXpAmount(5);
      setShowXP(true);
      addXP({ type: 'reading', amount: 5, description: 'Translation' });

    } catch (error) {
      console.error('Translation error:', error);
      setResult({ translation: 'Translation failed. Try again.' });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSpeak = () => {
    if (!result) return;
    const textToSpeak = direction === 'en-to-ja' ? result.translation : inputText;
    speakJapanese(textToSpeak);

    // Award XP for listening
    setXpAmount(2);
    setShowXP(true);
    addXP({ type: 'quiz', amount: 2, description: 'Listening' });
  };

  const handlePractice = () => {
    if (!result) return;
    setIsPracticing(true);

    // Animate practice mode
    Animated.timing(practiceAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto-play pronunciation
    setTimeout(() => {
      const textToSpeak = direction === 'en-to-ja' ? result.translation : inputText;
      speakJapanese(textToSpeak);
    }, 500);
  };

  const handlePracticeComplete = () => {
    setIsPracticing(false);
    practiceAnim.setValue(0);

    // Award XP for practice
    setXpAmount(10);
    setShowXP(true);
    addXP({ type: 'speak', amount: 10, description: 'Speaking practice!' });
  };

  const handleSave = () => {
    if (!result || isSaved) return;

    const isToJapanese = direction === 'en-to-ja';
    saveTranslation({
      sourceText: inputText,
      sourceLanguage: isToJapanese ? 'en' : 'ja',
      targetText: result.translation,
      targetLanguage: isToJapanese ? 'ja' : 'en',
      reading: result.reading,
      romaji: result.romaji,
      folderId: undefined,
      tags: [],
      isFavorite: false,
    });

    setIsSaved(true);
    setXpAmount(10);
    setShowXP(true);
    addXP({ type: 'word', amount: 10, description: 'Phrase saved!' });
  };

  const handleSwapDirection = () => {
    setDirection((prev) => (prev === 'en-to-ja' ? 'ja-to-en' : 'en-to-ja'));
    if (result) {
      setInputText(result.translation);
      setResult(null);
    }
  };

  // Quick phrases
  const quickPhrases = [
    'Hello', 'Thank you', 'Excuse me', 'How much?',
    'Where is the station?', 'I want this', 'Delicious!', 'Help me',
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* XP Popup */}
      <XPPopup amount={xpAmount} visible={showXP} onHide={() => setShowXP(false)} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Translate</Text>
        <TouchableOpacity
          onPress={() => router.push('/saved-translations')}
          style={styles.savedButton}
        >
          <Ionicons name="bookmark" size={22} color={colors.white} />
          {savedTranslations.length > 0 && (
            <View style={styles.savedBadge}>
              <Text style={styles.savedBadgeText}>{savedTranslations.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Direction Toggle */}
        <View style={styles.directionRow}>
          <Text style={styles.langText}>
            {direction === 'en-to-ja' ? 'English' : 'Japanese'}
          </Text>
          <TouchableOpacity style={styles.swapButton} onPress={handleSwapDirection}>
            <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.langText}>
            {direction === 'en-to-ja' ? 'Japanese' : 'English'}
          </Text>
        </View>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={direction === 'en-to-ja' ? 'Type in English...' : 'Type in Japanese...'}
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            autoFocus
            onSubmitEditing={handleTranslate}
            returnKeyType="go"
          />
          {inputText.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setInputText('');
                setResult(null);
                setIsSaved(false);
              }}
            >
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Translate Button */}
        <TouchableOpacity
          style={[styles.translateButton, (!inputText.trim() || isTranslating) && styles.buttonDisabled]}
          onPress={handleTranslate}
          disabled={!inputText.trim() || isTranslating}
        >
          {isTranslating ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="language" size={22} color={colors.white} />
              <Text style={styles.translateButtonText}>Translate</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Result Card */}
        {result && result.translation !== 'Translation failed. Try again.' && (
          <Animated.View
            style={[
              styles.resultCard,
              {
                opacity: resultAnim,
                transform: [{
                  translateY: resultAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                }],
              },
            ]}
          >
            {/* Main Translation */}
            <Text style={styles.translationText}>{result.translation}</Text>

            {/* Reading & Romaji */}
            {result.reading && (
              <View style={styles.readingRow}>
                <Text style={styles.readingLabel}>Reading</Text>
                <Text style={styles.readingText}>{result.reading}</Text>
              </View>
            )}
            {result.romaji && (
              <View style={styles.readingRow}>
                <Text style={styles.readingLabel}>Romaji</Text>
                <Text style={styles.romajiText}>{result.romaji}</Text>
              </View>
            )}

            {/* Word Breakdown */}
            {result.breakdown && result.breakdown.length > 0 && (
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownTitle}>Word Breakdown</Text>
                <View style={styles.breakdownList}>
                  {result.breakdown.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.breakdownItem}
                      onPress={() => speakJapanese(item.word)}
                    >
                      <Text style={styles.breakdownWord}>{item.word}</Text>
                      <Text style={styles.breakdownReading}>{item.reading}</Text>
                      <Text style={styles.breakdownMeaning}>{item.meaning}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              {/* Listen */}
              <TouchableOpacity style={styles.actionButton} onPress={handleSpeak}>
                <Ionicons name="volume-high" size={24} color={colors.primary} />
                <Text style={styles.actionText}>Listen</Text>
              </TouchableOpacity>

              {/* Practice */}
              <TouchableOpacity
                style={[styles.actionButton, styles.practiceButton]}
                onPress={handlePractice}
              >
                <Ionicons name="mic" size={24} color={colors.white} />
                <Text style={[styles.actionText, { color: colors.white }]}>Practice</Text>
              </TouchableOpacity>

              {/* Save */}
              <TouchableOpacity
                style={[styles.actionButton, isSaved && styles.savedAction]}
                onPress={handleSave}
                disabled={isSaved}
              >
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={24}
                  color={isSaved ? colors.mint : colors.textMuted}
                />
                <Text style={[styles.actionText, isSaved && { color: colors.mint }]}>
                  {isSaved ? 'Saved' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Quick Phrases */}
        {!result && (
          <View style={styles.quickSection}>
            <Text style={styles.quickTitle}>Quick Phrases</Text>
            <View style={styles.quickGrid}>
              {quickPhrases.map((phrase, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.quickChip}
                  onPress={() => {
                    setInputText(phrase);
                    setResult(null);
                    setIsSaved(false);
                  }}
                >
                  <Text style={styles.quickChipText}>{phrase}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Practice Overlay */}
      {isPracticing && (
        <Animated.View
          style={[
            styles.practiceOverlay,
            {
              opacity: practiceAnim,
            },
          ]}
        >
          <View style={styles.practiceContent}>
            <Text style={styles.practiceTitle}>Say this phrase:</Text>
            <Text style={styles.practicePhrase}>{result?.translation}</Text>
            {result?.romaji && (
              <Text style={styles.practiceRomaji}>{result.romaji}</Text>
            )}

            <TouchableOpacity style={styles.listenAgainButton} onPress={handleSpeak}>
              <Ionicons name="volume-high" size={24} color={colors.primary} />
              <Text style={styles.listenAgainText}>Listen again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={handlePracticeComplete}
            >
              <Ionicons name="checkmark-circle" size={24} color={colors.white} />
              <Text style={styles.doneButtonText}>Done practicing</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: '700',
  },
  savedButton: {
    padding: spacing.sm,
    position: 'relative',
  },
  savedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },

  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Direction
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  langText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: '600',
  },
  swapButton: {
    padding: spacing.sm,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: borderRadius.full,
  },

  // Input
  inputContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minHeight: 100,
    marginBottom: spacing.md,
  },
  input: {
    color: colors.white,
    fontSize: typography.lg,
    lineHeight: 28,
    flex: 1,
  },
  clearButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },

  // Translate Button
  translateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  translateButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: '700',
  },

  // Result Card
  resultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  translationText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 38,
    marginBottom: spacing.md,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  readingLabel: {
    color: colors.textMuted,
    fontSize: typography.sm,
    width: 60,
  },
  readingText: {
    color: colors.white,
    fontSize: typography.base,
  },
  romajiText: {
    color: colors.primary,
    fontSize: typography.base,
  },

  // Breakdown
  breakdownSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  breakdownTitle: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  breakdownList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  breakdownItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    minWidth: 80,
  },
  breakdownWord: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: '600',
  },
  breakdownReading: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    marginTop: 2,
  },
  breakdownMeaning: {
    color: colors.textMuted,
    fontSize: typography.xs,
    marginTop: 2,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  practiceButton: {
    backgroundColor: colors.mint,
  },
  savedAction: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
  },
  actionText: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: '600',
  },

  // Quick Phrases
  quickSection: {
    marginTop: spacing.lg,
  },
  quickTitle: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: '600',
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  quickChipText: {
    color: colors.white,
    fontSize: typography.sm,
  },

  // Practice Overlay
  practiceOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  practiceContent: {
    alignItems: 'center',
    width: '100%',
  },
  practiceTitle: {
    color: colors.textMuted,
    fontSize: typography.base,
    marginBottom: spacing.md,
  },
  practicePhrase: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  practiceRomaji: {
    color: colors.primary,
    fontSize: typography.lg,
    marginBottom: spacing.xl,
  },
  listenAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  listenAgainText: {
    color: colors.primary,
    fontSize: typography.base,
    fontWeight: '600',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  doneButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: '700',
  },
});

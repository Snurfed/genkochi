import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FuriganaSegment, Word } from '../types';
import { speakJapanese } from '../utils/speech';
import { colors, typography, spacing, borderRadius, shadows } from '../constants/design';

// Hiragana to romaji conversion map
const HIRAGANA_TO_ROMAJI: Record<string, string> = {
  // Vowels
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  // K row
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  // S row
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  // T row
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  // N row
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  // H row
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  // M row
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  // Y row
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  // R row
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  // W row
  'わ': 'wa', 'を': 'wo', 'ん': 'n',
  // Voiced consonants
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'di', 'づ': 'du', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  // Combinations
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  // Small characters
  'っ': '', 'ー': '-',
  'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo',
};

// Common particles and their English meanings
const PARTICLE_MEANINGS: Record<string, { short: string; explanation: string }> = {
  'が': { short: 'subject marker', explanation: 'Marks the subject of the sentence (who/what does the action)' },
  'は': { short: 'topic marker', explanation: 'Marks the topic - "as for [this]..."' },
  'を': { short: 'object marker', explanation: 'Marks the direct object (what receives the action)' },
  'に': { short: 'to/at/in', explanation: 'Indicates direction, location, time, or recipient' },
  'で': { short: 'at/by/with', explanation: 'Indicates where action happens or means/method used' },
  'の': { short: 'of/\'s', explanation: 'Shows possession or connects nouns (like "of" or "\'s")' },
  'と': { short: 'and/with', explanation: 'Connects nouns ("and") or indicates doing something with someone' },
  'も': { short: 'also/too', explanation: 'Means "also" or "too" - adds to what was said' },
  'へ': { short: 'toward', explanation: 'Indicates direction of movement (toward somewhere)' },
  'から': { short: 'from', explanation: 'Indicates starting point in time or space' },
  'まで': { short: 'until/to', explanation: 'Indicates ending point ("until" or "up to")' },
  'より': { short: 'than/from', explanation: 'Used for comparisons ("more than")' },
  'か': { short: 'question', explanation: 'Makes the sentence a question (like "?")' },
  'ね': { short: 'right?', explanation: 'Seeking agreement - "isn\'t it?" or "right?"' },
  'よ': { short: 'emphasis', explanation: 'Adds emphasis or asserts information to listener' },
  'な': { short: 'adjective suffix', explanation: 'Connects な-adjectives to nouns' },
};

// Common words with meanings (for content words)
const COMMON_WORDS: Record<string, { meaning: string; explanation: string }> = {
  // Size/amount
  '大': { meaning: 'big, large', explanation: 'Describes something of large size' },
  '大きい': { meaning: 'big, large', explanation: 'い-adjective meaning "big" or "large"' },
  '大きな': { meaning: 'big, large', explanation: 'な-adjective form meaning "big" or "large"' },
  '小': { meaning: 'small, little', explanation: 'Describes something of small size' },
  '小さい': { meaning: 'small, little', explanation: 'い-adjective meaning "small" or "little"' },
  '小さな': { meaning: 'small, little', explanation: 'な-adjective form meaning "small"' },
  '多い': { meaning: 'many, much', explanation: 'Describes a large quantity' },
  '少ない': { meaning: 'few, little', explanation: 'Describes a small quantity' },
  // Location
  '上': { meaning: 'above, on top', explanation: 'Position above or on top of something' },
  '下': { meaning: 'below, under', explanation: 'Position below or underneath something' },
  '中': { meaning: 'inside, middle', explanation: 'Position inside or in the middle' },
  '外': { meaning: 'outside', explanation: 'Position outside of something' },
  '前': { meaning: 'front, before', explanation: 'Position in front or time before' },
  '後ろ': { meaning: 'behind, back', explanation: 'Position behind something' },
  '右': { meaning: 'right', explanation: 'Right side/direction' },
  '左': { meaning: 'left', explanation: 'Left side/direction' },
  '横': { meaning: 'beside, next to', explanation: 'Position beside something' },
  '近く': { meaning: 'nearby', explanation: 'Close in distance' },
  // Common nouns
  '人': { meaning: 'person', explanation: 'A human being' },
  '物': { meaning: 'thing', explanation: 'An object or item' },
  '所': { meaning: 'place', explanation: 'A location or spot' },
  '時': { meaning: 'time, when', explanation: 'Point in time or occasion' },
  '今': { meaning: 'now', explanation: 'The present moment' },
  '日': { meaning: 'day, sun', explanation: 'A day or the sun' },
  '本': { meaning: 'book', explanation: 'A book or origin/root' },
  '水': { meaning: 'water', explanation: 'Water or liquid' },
  '花': { meaning: 'flower', explanation: 'A flower or blossom' },
  '木': { meaning: 'tree', explanation: 'A tree or wood' },
  // Colors
  '赤い': { meaning: 'red', explanation: 'The color red' },
  '青い': { meaning: 'blue', explanation: 'The color blue' },
  '白い': { meaning: 'white', explanation: 'The color white' },
  '黒い': { meaning: 'black', explanation: 'The color black' },
  // Common hiragana words
  'きな': { meaning: '(makes adjective)', explanation: 'Suffix that connects adjectives like 大 to nouns' },
  'ある': { meaning: 'to exist, there is', explanation: 'Verb meaning something exists (for objects)' },
  'いる': { meaning: 'to exist, there is', explanation: 'Verb meaning something exists (for people/animals)' },
  'する': { meaning: 'to do', explanation: 'Verb meaning "to do" or "to make"' },
  'なる': { meaning: 'to become', explanation: 'Verb meaning "to become" or "to turn into"' },
  'くる': { meaning: 'to come', explanation: 'Verb meaning "to come"' },
  'いく': { meaning: 'to go', explanation: 'Verb meaning "to go"' },
  '行く': { meaning: 'to go', explanation: 'Verb meaning "to go"' },
  '来る': { meaning: 'to come', explanation: 'Verb meaning "to come"' },
  'この': { meaning: 'this', explanation: 'Demonstrative meaning "this" (near speaker)' },
  'その': { meaning: 'that', explanation: 'Demonstrative meaning "that" (near listener)' },
  'あの': { meaning: 'that over there', explanation: 'Demonstrative for things far from both speaker and listener' },
};

// Common verb endings and forms
const VERB_ENDINGS: Record<string, { short: string; explanation: string }> = {
  'ます': { short: 'polite form', explanation: 'Polite present/future tense ending' },
  'ました': { short: 'polite past', explanation: 'Polite past tense - "did" or "was"' },
  'ません': { short: 'polite negative', explanation: 'Polite negative - "do not" or "will not"' },
  'ませんでした': { short: 'polite past negative', explanation: 'Polite past negative - "did not"' },
  'て': { short: 'te-form', explanation: 'Connects actions or makes requests' },
  'ている': { short: 'ongoing action', explanation: 'Action in progress or resulting state' },
  'ています': { short: 'is ~ing', explanation: 'Polite form of ongoing action - "is doing"' },
  'です': { short: 'is/am/are', explanation: 'Polite copula - states what something is' },
  'だ': { short: 'is (casual)', explanation: 'Casual form of "is" - states what something is' },
  'でした': { short: 'was', explanation: 'Polite past copula - "was" or "were"' },
  'ではない': { short: 'is not', explanation: 'Negative copula - "is not"' },
  'じゃない': { short: 'is not (casual)', explanation: 'Casual negative - "is not"' },
  'あります': { short: 'there is (thing)', explanation: 'Polite existence verb for objects/things - "there is"' },
  'ありません': { short: 'there is not', explanation: 'Negative - "there is no" (for things)' },
  'います': { short: 'there is (living)', explanation: 'Polite existence verb for people/animals - "there is"' },
  'いません': { short: 'there is not', explanation: 'Negative - "there is no" (for living things)' },
  'ない': { short: 'not/none', explanation: 'Negative form - "not" or "don\'t have"' },
  'たい': { short: 'want to', explanation: 'Expresses desire - "want to ~"' },
  'ましょう': { short: 'let\'s', explanation: 'Suggestion or invitation - "let\'s ~"' },
  'ください': { short: 'please do', explanation: 'Polite request - "please ~"' },
  'できます': { short: 'can do', explanation: 'Ability - "can" or "is able to"' },
  'がある': { short: 'there is', explanation: 'Casual existence - "there is" (for things)' },
  'がいる': { short: 'there is', explanation: 'Casual existence - "there is" (for living things)' },
};

// Convert hiragana/katakana to romaji
function toRomaji(text: string): string {
  let result = '';
  let i = 0;

  // Convert katakana to hiragana first
  const hiragana = text.replace(/[\u30A1-\u30F6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });

  while (i < hiragana.length) {
    // Try two-character combinations first
    if (i + 1 < hiragana.length) {
      const twoChar = hiragana.substring(i, i + 2);
      if (HIRAGANA_TO_ROMAJI[twoChar]) {
        result += HIRAGANA_TO_ROMAJI[twoChar];
        i += 2;
        continue;
      }
    }

    // Single character
    const oneChar = hiragana[i];
    if (HIRAGANA_TO_ROMAJI[oneChar]) {
      result += HIRAGANA_TO_ROMAJI[oneChar];
    } else {
      result += oneChar; // Keep as-is if not found
    }
    i++;
  }

  return result;
}

interface MeaningResult {
  meaning: string;
  explanation: string;
  type: 'particle' | 'word' | 'grammar' | 'verb' | 'unknown';
}

// Get English meaning for a segment
function getSegmentMeaning(segment: FuriganaSegment, linkedWords?: Word[]): MeaningResult {
  const empty: MeaningResult = { meaning: '', explanation: '', type: 'unknown' };

  // Check if it's a particle
  const particleInfo = PARTICLE_MEANINGS[segment.text] || PARTICLE_MEANINGS[segment.reading];
  if (particleInfo) {
    return {
      meaning: particleInfo.short,
      explanation: particleInfo.explanation,
      type: 'particle',
    };
  }

  // Check common words dictionary
  const wordInfo = COMMON_WORDS[segment.text] || COMMON_WORDS[segment.reading];
  if (wordInfo) {
    return {
      meaning: wordInfo.meaning,
      explanation: wordInfo.explanation,
      type: 'word',
    };
  }

  // Check if it matches a linked word
  if (linkedWords) {
    const matchedWord = linkedWords.find(
      w => w.japanese === segment.text || w.reading === segment.reading
    );
    if (matchedWord) {
      return {
        meaning: matchedWord.english,
        explanation: `Vocabulary word from your lesson`,
        type: 'word',
      };
    }
  }

  // Check verb endings (check longer patterns first)
  const sortedEndings = Object.entries(VERB_ENDINGS).sort((a, b) => b[0].length - a[0].length);
  for (const [ending, info] of sortedEndings) {
    if (segment.text === ending || segment.reading === ending ||
        segment.text.endsWith(ending) || segment.reading.endsWith(ending)) {
      return {
        meaning: info.short,
        explanation: info.explanation,
        type: 'verb',
      };
    }
  }

  // Check if it's pure hiragana (likely grammatical)
  if (!segment.isKanji && segment.text === segment.reading) {
    return {
      meaning: 'grammar element',
      explanation: 'A grammatical component that connects or modifies words',
      type: 'grammar',
    };
  }

  // For kanji we don't recognize, indicate it's a vocabulary word
  if (segment.isKanji) {
    return {
      meaning: '',
      explanation: 'Tap to hear pronunciation',
      type: 'word',
    };
  }

  return empty;
}

interface SentenceWordBreakdownProps {
  segments: FuriganaSegment[];
  linkedWords?: Word[];
  showRomaji?: boolean;
  onWordPress?: (segment: FuriganaSegment, index: number) => void;
  // Word-level segmentation from AI (preferred over character-based furigana)
  words?: {
    word: string;
    reading: string;
    meaning: string;
    role?: string;
  }[];
}

interface SelectedWord {
  segment: FuriganaSegment;
  romaji: string;
  meaning: string;
  explanation: string;
  type: 'particle' | 'word' | 'grammar' | 'verb' | 'unknown';
  index: number;
}

export function SentenceWordBreakdown({
  segments,
  linkedWords,
  showRomaji = true,
  onWordPress,
  words,
}: SentenceWordBreakdownProps) {
  const [selectedWord, setSelectedWord] = useState<SelectedWord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Convert AI word breakdown to FuriganaSegment format for display
  // This provides linguistically correct word boundaries
  const displaySegments: FuriganaSegment[] = useMemo(() => {
    if (words && words.length > 0) {
      return words.map(w => ({
        text: w.word,
        reading: w.reading,
        isKanji: /[一-龯]/.test(w.word), // Check if contains kanji
        meaning: w.meaning,
        role: w.role,
      }));
    }
    return segments;
  }, [words, segments]);

  const handleWordPress = (segment: FuriganaSegment, index: number) => {
    const romaji = toRomaji(segment.reading || segment.text);

    // Prefer meaning from AI word-level breakdown if available
    let meaning = segment.meaning || '';
    let explanation = '';
    let type: 'particle' | 'word' | 'grammar' | 'verb' | 'unknown' = 'word';

    if (segment.role) {
      // Use the role from AI segmentation
      type = segment.role === 'particle' ? 'particle' :
             segment.role === 'verb' ? 'verb' : 'word';
      explanation = segment.role;
    }

    // Fall back to getSegmentMeaning if no AI-provided meaning
    if (!meaning) {
      const meaningResult = getSegmentMeaning(segment, linkedWords);
      meaning = meaningResult.meaning;
      explanation = meaningResult.explanation;
      type = meaningResult.type;
    }

    setSelectedWord({
      segment,
      romaji,
      meaning,
      explanation,
      type,
      index,
    });

    if (onWordPress) {
      onWordPress(segment, index);
    }
  };

  const handlePlayAudio = async () => {
    if (!selectedWord) return;
    setIsPlaying(true);
    // Use hiragana reading for accurate pronunciation
    await speakJapanese(selectedWord.segment.reading || selectedWord.segment.text, {
      slow: true,
      onDone: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  const closeModal = () => {
    setSelectedWord(null);
  };

  return (
    <View style={styles.container}>
      {/* Sentence with clickable words */}
      <View style={styles.sentenceRow}>
        {displaySegments.map((segment, index) => (
          <TouchableOpacity
            key={`${segment.text}-${index}`}
            style={[
              styles.wordContainer,
              selectedWord?.index === index && styles.wordContainerSelected,
            ]}
            onPress={() => handleWordPress(segment, index)}
            activeOpacity={0.7}
          >
            {/* Furigana reading above */}
            {segment.isKanji && segment.reading && (
              <Text style={styles.furigana}>{segment.reading}</Text>
            )}

            {/* Main Japanese text */}
            <Text style={[
              styles.japaneseText,
              segment.isKanji && styles.kanjiText,
            ]}>
              {segment.text}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Word detail modal */}
      <Modal
        visible={selectedWord !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {selectedWord && (
              <>
                {/* Close button */}
                <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>

                {/* Japanese with furigana */}
                <View style={styles.modalHeader}>
                  {selectedWord.segment.isKanji && selectedWord.segment.reading && (
                    <Text style={styles.modalFurigana}>
                      {selectedWord.segment.reading}
                    </Text>
                  )}
                  <Text style={styles.modalJapanese}>
                    {selectedWord.segment.text}
                  </Text>
                </View>

                {/* Romaji */}
                <Text style={styles.modalRomaji}>
                  {selectedWord.romaji}
                </Text>

                {/* English meaning */}
                {selectedWord.meaning && (
                  <Text style={styles.modalMeaning}>
                    {selectedWord.meaning}
                  </Text>
                )}

                {/* Explanation */}
                {selectedWord.explanation && (
                  <Text style={styles.modalExplanation}>
                    {selectedWord.explanation}
                  </Text>
                )}

                {/* Audio button */}
                <TouchableOpacity
                  style={[styles.audioButton, isPlaying && styles.audioButtonPlaying]}
                  onPress={handlePlayAudio}
                  disabled={isPlaying}
                >
                  <Ionicons
                    name={isPlaying ? 'volume-high' : 'volume-medium'}
                    size={24}
                    color={colors.white}
                  />
                  <Text style={styles.audioButtonText}>
                    {isPlaying ? 'Playing...' : 'Listen'}
                  </Text>
                </TouchableOpacity>

                {/* Part of speech indicator */}
                {selectedWord.type !== 'unknown' && (
                  <View style={[
                    styles.posContainer,
                    selectedWord.type === 'particle' && styles.posParticle,
                    selectedWord.type === 'verb' && styles.posVerb,
                    selectedWord.type === 'grammar' && styles.posGrammar,
                  ]}>
                    <Text style={styles.posText}>
                      {selectedWord.type === 'particle' ? 'PARTICLE' :
                       selectedWord.type === 'verb' ? 'VERB FORM' :
                       selectedWord.type === 'grammar' ? 'GRAMMAR' :
                       'WORD'}
                    </Text>
                  </View>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  sentenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  wordContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'transparent',
  },
  wordContainerSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  furigana: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 1,
  },
  japaneseText: {
    fontSize: 24,
    color: colors.textPrimary || colors.navy,
    fontWeight: '500',
  },
  kanjiText: {
    fontWeight: '600',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
    ...shadows.lg,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.xs,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalFurigana: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 2,
  },
  modalJapanese: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.textPrimary || colors.navy,
  },
  modalRomaji: {
    fontSize: typography.lg,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  modalMeaning: {
    fontSize: typography.lg,
    color: colors.textPrimary || colors.navy,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  modalExplanation: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
    lineHeight: 20,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  audioButtonPlaying: {
    backgroundColor: colors.mint,
  },
  audioButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: '600',
  },
  posContainer: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  posParticle: {
    backgroundColor: '#E8F5E9',
  },
  posVerb: {
    backgroundColor: '#E3F2FD',
  },
  posGrammar: {
    backgroundColor: '#FFF3E0',
  },
  posText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
});

export default SentenceWordBreakdown;

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store';
import { colors, spacing, borderRadius, typography, shadows } from '../../src/constants/design';
import { ReadingLevel, READING_LEVELS } from '../../src/types';

const READING_LEVEL_INFO: Record<ReadingLevel, { name: string; description: string; icon: string }> = {
  romaji: {
    name: 'Romaji Reader',
    description: 'Show romaji primarily. Good for absolute beginners.',
    icon: 'A',
  },
  kana: {
    name: 'Kana Learner',
    description: 'Learning hiragana and katakana. Romaji as backup.',
    icon: 'あ',
  },
  'kanji-basic': {
    name: 'Kanji Beginner',
    description: 'Starting kanji. Furigana always shown.',
    icon: '漢',
  },
  'kanji-read': {
    name: 'Kanji Reader',
    description: 'Growing kanji skills. Furigana on tap.',
    icon: '読',
  },
  fluent: {
    name: 'Fluent Reader',
    description: 'Comfortable reading. Minimal assistance.',
    icon: '流',
  },
};

export default function SettingsScreen() {
  const router = useRouter();
  const { stats, lessons } = useAppStore();

  // Local state for settings (would be persisted to store in production)
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>(
    stats.reading?.currentLevel || 'romaji'
  );
  const [showFurigana, setShowFurigana] = useState<'always' | 'kanji-only' | 'on-tap' | 'never'>('always');
  const [showRomaji, setShowRomaji] = useState<'always' | 'on-tap' | 'never'>('always');
  const [includeReadingQuizzes, setIncludeReadingQuizzes] = useState(true);
  const [autoProgress, setAutoProgress] = useState(true);

  // Calculate kana progress
  const hiraganaCount = stats.reading?.hiraganaKnown?.length || 0;
  const katakanaCount = stats.reading?.katakanaKnown?.length || 0;
  const kanjiCount = stats.reading?.kanjiCount || 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Reading Level Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reading Level</Text>
          <Text style={styles.sectionSubtitle}>
            Choose your Japanese reading comfort level
          </Text>

          <View style={styles.levelCards}>
            {(Object.keys(READING_LEVEL_INFO) as ReadingLevel[]).map((level) => {
              const info = READING_LEVEL_INFO[level];
              const isSelected = readingLevel === level;

              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.levelCard, isSelected && styles.levelCardSelected]}
                  onPress={() => setReadingLevel(level)}
                >
                  <View style={[styles.levelIcon, isSelected && styles.levelIconSelected]}>
                    <Text style={[styles.levelIconText, isSelected && styles.levelIconTextSelected]}>
                      {info.icon}
                    </Text>
                  </View>
                  <View style={styles.levelInfo}>
                    <Text style={[styles.levelName, isSelected && styles.levelNameSelected]}>
                      {info.name}
                    </Text>
                    <Text style={styles.levelDesc}>{info.description}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.mint} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Kana Progress Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kana Progress</Text>

          <View style={styles.progressCards}>
            {/* Hiragana */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressIcon}>あ</Text>
                <Text style={styles.progressLabel}>Hiragana</Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${(hiraganaCount / 46) * 100}%` }]}
                />
              </View>
              <Text style={styles.progressText}>{hiraganaCount} / 46</Text>
            </View>

            {/* Katakana */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressIcon}>ア</Text>
                <Text style={styles.progressLabel}>Katakana</Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, styles.progressFillKatakana, { width: `${(katakanaCount / 46) * 100}%` }]}
                />
              </View>
              <Text style={styles.progressText}>{katakanaCount} / 46</Text>
            </View>

            {/* Kanji */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressIcon}>漢</Text>
                <Text style={styles.progressLabel}>Kanji</Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, styles.progressFillKanji, { width: `${Math.min((kanjiCount / 200) * 100, 100)}%` }]}
                />
              </View>
              <Text style={styles.progressText}>{kanjiCount} learned</Text>
            </View>
          </View>

          {/* Kana Practice Button */}
          <TouchableOpacity
            style={styles.practiceButton}
            onPress={() => router.push('/kana-practice')}
          >
            <Ionicons name="school" size={20} color={colors.white} />
            <Text style={styles.practiceButtonText}>Practice Kana</Text>
          </TouchableOpacity>
        </View>

        {/* Display Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display Settings</Text>

          {/* Furigana */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show Furigana</Text>
              <Text style={styles.settingDesc}>Reading hints above kanji</Text>
            </View>
            <TouchableOpacity
              style={styles.settingPicker}
              onPress={() => {
                const options: typeof showFurigana[] = ['always', 'kanji-only', 'on-tap', 'never'];
                const currentIdx = options.indexOf(showFurigana);
                setShowFurigana(options[(currentIdx + 1) % options.length]);
              }}
            >
              <Text style={styles.settingPickerText}>
                {showFurigana === 'always' ? 'Always' :
                 showFurigana === 'kanji-only' ? 'Kanji only' :
                 showFurigana === 'on-tap' ? 'On tap' : 'Never'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Romaji */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show Romaji</Text>
              <Text style={styles.settingDesc}>Romanized pronunciation</Text>
            </View>
            <TouchableOpacity
              style={styles.settingPicker}
              onPress={() => {
                const options: typeof showRomaji[] = ['always', 'on-tap', 'never'];
                const currentIdx = options.indexOf(showRomaji);
                setShowRomaji(options[(currentIdx + 1) % options.length]);
              }}
            >
              <Text style={styles.settingPickerText}>
                {showRomaji === 'always' ? 'Always' :
                 showRomaji === 'on-tap' ? 'On tap' : 'Never'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quiz Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiz Settings</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Reading Quizzes</Text>
              <Text style={styles.settingDesc}>Include kanji reading questions</Text>
            </View>
            <Switch
              value={includeReadingQuizzes}
              onValueChange={setIncludeReadingQuizzes}
              trackColor={{ false: colors.navyLight, true: colors.mint }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-Progress</Text>
              <Text style={styles.settingDesc}>Advance reading level automatically</Text>
            </View>
            <Switch
              value={autoProgress}
              onValueChange={setAutoProgress}
              trackColor={{ false: colors.navyLight, true: colors.mint }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalWords}</Text>
              <Text style={styles.statLabel}>Words Learned</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{lessons.length}</Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.xp }]}>{stats.xp}</Text>
              <Text style={styles.statLabel}>Total XP</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#FF9632' }]}>{stats.streak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  // Sections
  section: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyLight,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },

  // Level Cards
  levelCards: {
    gap: spacing.sm,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyLight,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  levelCardSelected: {
    borderColor: colors.mint,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
  },
  levelIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  levelIconSelected: {
    backgroundColor: colors.mint,
  },
  levelIconText: {
    fontSize: typography.xl,
    color: colors.white,
    fontWeight: typography.bold,
  },
  levelIconTextSelected: {
    color: colors.navy,
  },
  levelInfo: {
    flex: 1,
  },
  levelName: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.white,
  },
  levelNameSelected: {
    color: colors.mint,
  },
  levelDesc: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Progress Cards
  progressCards: {
    gap: spacing.md,
  },
  progressCard: {
    backgroundColor: colors.navyLight,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressIcon: {
    fontSize: typography.xl,
    color: colors.white,
    marginRight: spacing.sm,
  },
  progressLabel: {
    fontSize: typography.base,
    color: colors.white,
    fontWeight: typography.medium,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.navy,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.mint,
    borderRadius: borderRadius.full,
  },
  progressFillKatakana: {
    backgroundColor: colors.primary,
  },
  progressFillKanji: {
    backgroundColor: colors.xp,
  },
  progressText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'right',
  },
  practiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  practiceButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: typography.bold,
  },

  // Setting Rows
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyLight,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: typography.base,
    color: colors.white,
    fontWeight: typography.medium,
  },
  settingDesc: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  settingPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settingPickerText: {
    fontSize: typography.sm,
    color: colors.mint,
    fontWeight: typography.medium,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.navyLight,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  statLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

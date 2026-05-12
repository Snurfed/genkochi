import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography, shadows } from '../src/constants/design';
import { useAppStore } from '../src/store';
import { SUPPORTED_LANGUAGES, Language } from '../src/constants/languages';
import { getTranslations } from '../src/constants/translations';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type OnboardingStep = 'native' | 'target' | 'goal' | 'ready';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { setNativeLanguage, setTargetLanguage, setLearningGoal, completeOnboarding } = useAppStore();

  const [step, setStep] = useState<OnboardingStep>('native');
  const [selectedNativeLanguage, setSelectedNativeLanguage] = useState<Language | null>(null);
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState<Language | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  // Get translations based on selected native language (default to English)
  const t = useMemo(() => {
    return getTranslations(selectedNativeLanguage?.code || 'en');
  }, [selectedNativeLanguage]);

  // Learning goals using translations
  const LEARNING_GOALS = useMemo(() => [
    { id: 'travel', emoji: '✈️', title: t.goals.travel, subtitle: t.goals.travelDesc },
    { id: 'culture', emoji: '🎭', title: t.goals.culture, subtitle: t.goals.cultureDesc },
    { id: 'connect', emoji: '💬', title: t.goals.connect, subtitle: t.goals.connectDesc },
    { id: 'work', emoji: '💼', title: t.goals.work, subtitle: t.goals.workDesc },
    { id: 'curiosity', emoji: '🧠', title: t.goals.curiosity, subtitle: t.goals.curiosityDesc },
  ], [t]);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (nextStep: OnboardingStep) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => setStep(nextStep), 150);
  };

  const handleNativeLanguageSelect = (lang: Language) => {
    setSelectedNativeLanguage(lang);
    setNativeLanguage(lang);
  };

  const handleTargetLanguageSelect = (lang: Language) => {
    setSelectedTargetLanguage(lang);
    setTargetLanguage(lang);
  };

  const handleGoalSelect = (goalId: string) => {
    setSelectedGoal(goalId);
    setLearningGoal(goalId as any);
  };

  const handleComplete = () => {
    completeOnboarding();
    router.replace('/');
  };

  const renderNativeLanguageSelect = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={styles.logoContainerSmall}>
          <LinearGradient
            colors={[colors.primary, '#7C3AED']}
            style={styles.logoGradientSmall}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="camera" size={28} color={colors.white} />
          </LinearGradient>
          <Text style={styles.logoText}>Genkochi</Text>
        </View>
        <Text style={styles.stepTitle}>{t.onboarding.nativeLanguageTitle}</Text>
        <Text style={styles.stepSubtitle}>{t.onboarding.nativeLanguageSubtitle}</Text>
      </View>

      <ScrollView
        style={styles.languageList}
        contentContainerStyle={styles.languageListContent}
        showsVerticalScrollIndicator={false}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.languageOption,
              selectedNativeLanguage?.code === lang.code && styles.languageOptionSelected,
            ]}
            onPress={() => handleNativeLanguageSelect(lang)}
          >
            <Text style={styles.languageFlag}>{lang.flag}</Text>
            <View style={styles.languageInfo}>
              <Text style={styles.languageName}>{lang.name}</Text>
              <Text style={styles.languageNative}>{lang.nativeName}</Text>
            </View>
            {selectedNativeLanguage?.code === lang.code && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.primaryButton, !selectedNativeLanguage && styles.buttonDisabled]}
        onPress={() => selectedNativeLanguage && animateTransition('target')}
        disabled={!selectedNativeLanguage}
      >
        <Text style={styles.primaryButtonText}>{t.onboarding.continue}</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  // Filter out native language from target options
  const targetLanguageOptions = SUPPORTED_LANGUAGES.filter(
    lang => lang.code !== selectedNativeLanguage?.code
  );

  const renderTargetLanguageSelect = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <TouchableOpacity onPress={() => animateTransition('native')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.stepTitle}>{t.onboarding.targetLanguageTitle}</Text>
        <Text style={styles.stepSubtitle}>{t.onboarding.targetLanguageSubtitle}</Text>
      </View>

      <ScrollView
        style={styles.languageList}
        contentContainerStyle={styles.languageListContent}
        showsVerticalScrollIndicator={false}
      >
        {targetLanguageOptions.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.languageOption,
              selectedTargetLanguage?.code === lang.code && styles.languageOptionSelected,
            ]}
            onPress={() => handleTargetLanguageSelect(lang)}
          >
            <Text style={styles.languageFlag}>{lang.flag}</Text>
            <View style={styles.languageInfo}>
              <Text style={styles.languageName}>{lang.name}</Text>
              <Text style={styles.languageNative}>{lang.nativeName}</Text>
            </View>
            {selectedTargetLanguage?.code === lang.code && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.primaryButton, !selectedTargetLanguage && styles.buttonDisabled]}
        onPress={() => selectedTargetLanguage && animateTransition('goal')}
        disabled={!selectedTargetLanguage}
      >
        <Text style={styles.primaryButtonText}>{t.onboarding.continue}</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  const renderGoalSelect = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <TouchableOpacity onPress={() => animateTransition('target')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.stepTitle}>{t.onboarding.goalTitle} {selectedTargetLanguage?.name}?</Text>
        <Text style={styles.stepSubtitle}>{t.onboarding.goalSubtitle}</Text>
      </View>

      <ScrollView
        style={styles.goalList}
        contentContainerStyle={styles.goalListContent}
        showsVerticalScrollIndicator={false}
      >
        {LEARNING_GOALS.map((goal) => (
          <TouchableOpacity
            key={goal.id}
            style={[
              styles.goalOption,
              selectedGoal === goal.id && styles.goalOptionSelected,
            ]}
            onPress={() => handleGoalSelect(goal.id)}
          >
            <Text style={styles.goalEmoji}>{goal.emoji}</Text>
            <View style={styles.goalInfo}>
              <Text style={styles.goalTitle}>{goal.title}</Text>
              <Text style={styles.goalSubtitle}>{goal.subtitle}</Text>
            </View>
            {selectedGoal === goal.id && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.primaryButton, !selectedGoal && styles.buttonDisabled]}
        onPress={() => selectedGoal && animateTransition('ready')}
        disabled={!selectedGoal}
      >
        <Text style={styles.primaryButtonText}>{t.onboarding.continue}</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  const renderReady = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <TouchableOpacity onPress={() => animateTransition('goal')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.readyContent}>
        <LinearGradient
          colors={[colors.primary + '20', colors.mint + '20']}
          style={styles.readyGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.readyIconWrap}>
            <Text style={styles.readyFlag}>{selectedTargetLanguage?.flag}</Text>
          </View>

          <Text style={styles.readyTitle}>{t.onboarding.readyTitle}</Text>
          <Text style={styles.readySubtitle}>
            {t.onboarding.readySubtitle} {selectedTargetLanguage?.name}?
          </Text>

          <View style={styles.readyStats}>
            <View style={styles.readyStat}>
              <Ionicons name="footsteps" size={20} color={colors.primary} />
              <Text style={styles.readyStatText}>0 {t.onboarding.steps}</Text>
            </View>
            <View style={styles.readyStatDivider} />
            <View style={styles.readyStat}>
              <Ionicons name="book" size={20} color={colors.mint} />
              <Text style={styles.readyStatText}>0 {t.onboarding.words}</Text>
            </View>
          </View>
        </LinearGradient>

        <Text style={styles.readyHint}>
          {t.onboarding.readyHint}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleComplete}
      >
        <Ionicons name="camera" size={20} color={colors.white} />
        <Text style={styles.primaryButtonText}>{t.onboarding.takeFirstPhoto}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'native':
        return renderNativeLanguageSelect();
      case 'target':
        return renderTargetLanguageSelect();
      case 'goal':
        return renderGoalSelect();
      case 'ready':
        return renderReady();
    }
  };

  // Progress indicator
  const steps: OnboardingStep[] = ['native', 'target', 'goal', 'ready'];
  const currentStepIndex = steps.indexOf(step);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Progress dots */}
      <View style={styles.progressDots}>
        {steps.map((s, idx) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              idx < currentStepIndex && styles.progressDotCompleted,
              idx === currentStepIndex && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      <Animated.View style={[styles.stepWrapper, { opacity: fadeAnim }]}>
        {renderStep()}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.md,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: colors.primary,
  },
  stepWrapper: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  // Step header
  stepHeader: {
    marginBottom: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.md,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  logoContainerSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  logoGradientSmall: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  logoText: {
    fontSize: typography.xl,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  stepTitle: {
    fontSize: typography.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },

  // Language selection
  languageList: {
    flex: 1,
  },
  languageListContent: {
    paddingBottom: spacing.md,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  languageOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  languageFlag: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  languageNative: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Goal selection
  goalList: {
    flex: 1,
  },
  goalListContent: {
    paddingBottom: spacing.md,
  },
  goalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  goalOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  goalEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  goalSubtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Ready screen
  readyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  readyGradient: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  readyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  readyFlag: {
    fontSize: 40,
  },
  readyTitle: {
    fontSize: typography.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  readySubtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  readyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  readyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  readyStatText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  readyStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  readyHint: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    ...shadows.md,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: '700',
  },
  buttonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
});

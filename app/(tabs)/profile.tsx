import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography, shadows } from '../../src/constants/design';
import { useAppStore } from '../../src/store';
import { useSubscription } from '../../src/hooks/useSubscription';
import { LearningGoal } from '../../src/types';
import { SUPPORTED_LANGUAGES, Language } from '../../src/constants/languages';
import { useTranslations } from '../../src/hooks/useTranslations';
import { notificationService } from '../../src/services/notificationService';

type LanguagePickerMode = 'native' | 'target' | null;
type ModalMode = LanguagePickerMode | 'goal' | 'time';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [reminderHour, setReminderHour] = useState(19);
  const [reminderMinute, setReminderMinute] = useState(0);
  const t = useTranslations();
  const { isPremium, showPaywall } = useSubscription();

  const {
    stats,
    learningGoal,
    nativeLanguage,
    targetLanguage,
    notificationsEnabled,
    setNativeLanguage,
    setTargetLanguage,
    setLearningGoal,
    setNotificationsEnabled,
    debugSimulateFading,
  } = useAppStore();

  // Load notification settings on mount
  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const settings = await notificationService.getSettings();
      setReminderHour(settings.reminderHour);
      setReminderMinute(settings.reminderMinute);
      if (settings.enabled !== notificationsEnabled) {
        setNotificationsEnabled(settings.enabled);
      }
    } catch (error) {
      if (__DEV__) console.log('[Profile] Failed to load notification settings:', error);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        const granted = await notificationService.requestPermission();
        if (granted) {
          setNotificationsEnabled(true);
          await notificationService.scheduleDailyReminder(
            reminderHour,
            reminderMinute,
            targetLanguage.name
          );
          if (stats.streak > 0) {
            await notificationService.scheduleStreakProtection(stats.streak, targetLanguage.name);
          }
        } else {
          Alert.alert(
            'Notifications Disabled',
            'Please enable notifications in your device Settings to receive practice reminders.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      } else {
        setNotificationsEnabled(false);
        await notificationService.cancelAllNotifications();
      }
    } catch (error) {
      if (__DEV__) console.log('[Profile] Notification toggle error:', error);
      setNotificationsEnabled(enabled);
    }
  };

  const handleTimeSelect = async (hour: number, minute: number) => {
    setReminderHour(hour);
    setReminderMinute(minute);
    setModalMode(null);

    try {
      if (notificationsEnabled) {
        await notificationService.scheduleDailyReminder(hour, minute, targetLanguage.name);
      }
    } catch (error) {
      if (__DEV__) console.log('[Profile] Failed to schedule reminder:', error);
    }
  };

  // Local time formatting to avoid issues with notification service during render
  const formatTime = (hour: number, minute: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
  };

  const reminderTimeDisplay = formatTime(reminderHour, reminderMinute);

  // Define learning goals with translations
  const LEARNING_GOALS = useMemo(() => [
    { id: 'travel' as LearningGoal, emoji: '✈️', title: t.goals.travel, subtitle: t.goals.travelDesc },
    { id: 'culture' as LearningGoal, emoji: '🎭', title: t.goals.culture, subtitle: t.goals.cultureDesc },
    { id: 'connect' as LearningGoal, emoji: '💬', title: t.goals.connect, subtitle: t.goals.connectDesc },
    { id: 'work' as LearningGoal, emoji: '💼', title: t.goals.work, subtitle: t.goals.workDesc },
    { id: 'curiosity' as LearningGoal, emoji: '🧠', title: t.goals.curiosity, subtitle: t.goals.curiosityDesc },
  ], [t]);

  const goalInfo = learningGoal
    ? LEARNING_GOALS.find(g => g.id === learningGoal)
    : null;

  const handleSelectLanguage = (lang: Language) => {
    if (modalMode === 'native') {
      setNativeLanguage(lang);
    } else if (modalMode === 'target') {
      setTargetLanguage(lang);
    }
    setModalMode(null);
  };

  const handleSelectGoal = (goal: LearningGoal) => {
    setLearningGoal(goal);
    setModalMode(null);
  };

  // Filter options based on mode
  const languageOptions = modalMode === 'target'
    ? SUPPORTED_LANGUAGES.filter(l => l.code !== nativeLanguage.code)
    : SUPPORTED_LANGUAGES;

  const handleHelpSupport = () => {
    Alert.alert(
      t.profile.helpSupport,
      'For help and support, please contact us at:\n\nsnurfedllc@gmail.com',
      [
        { text: 'OK' },
        { text: 'Send Email', onPress: () => Linking.openURL('mailto:snurfedllc@gmail.com') },
      ]
    );
  };

  const handleTermsOfService = () => {
    router.push('/terms');
  };

  const handlePrivacyPolicy = () => {
    router.push('/privacy');
  };

  const handleAbout = () => {
    Alert.alert(
      t.profile.about,
      'Genkochi v1.0.0\n\nLearn languages through your photos. Take pictures of the world around you and discover new vocabulary in context.\n\nMade with love for language learners everywhere.',
      [{ text: 'OK' }]
    );
  };

  const settingsItems = [
    {
      icon: 'person-outline',
      label: t.profile.myLanguage,
      value: `${nativeLanguage.flag} ${nativeLanguage.name}`,
      onPress: () => setModalMode('native'),
      type: 'nav' as const,
    },
    {
      icon: 'language-outline',
      label: t.profile.learning,
      value: `${targetLanguage.flag} ${targetLanguage.name}`,
      onPress: () => setModalMode('target'),
      type: 'nav' as const,
    },
    {
      icon: 'school-outline',
      label: t.profile.learningGoal,
      value: goalInfo ? `${goalInfo.emoji} ${goalInfo.title}` : 'Not set',
      onPress: () => setModalMode('goal'),
      type: 'nav' as const,
    },
    {
      icon: 'notifications-outline',
      label: t.profile.notifications,
      isToggle: true,
      toggleValue: notificationsEnabled,
      onToggle: handleNotificationToggle,
      type: 'toggle' as const,
    },
    {
      icon: 'time-outline',
      label: t.profile.dailyReminder,
      value: reminderTimeDisplay,
      onPress: () => setModalMode('time'),
      type: 'nav' as const,
      disabled: !notificationsEnabled,
    },
  ];

  const handleRestartTutorial = () => {
    // Reset onboarding state and navigate to onboarding
    useAppStore.setState({ hasCompletedOnboarding: false });
    router.replace('/onboarding');
  };

  const handleManageSubscription = () => {
    if (isPremium) {
      // Open App Store subscription management
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      showPaywall('settings_upgrade');
    }
  };

  const moreItems = [
    { icon: 'refresh-outline', label: t.profile.restartTutorial, onPress: handleRestartTutorial },
    { icon: 'help-circle-outline', label: t.profile.helpSupport, onPress: handleHelpSupport },
    { icon: 'document-text-outline', label: t.profile.termsOfService, onPress: handleTermsOfService },
    { icon: 'shield-checkmark-outline', label: t.profile.privacyPolicy, onPress: handlePrivacyPolicy },
    { icon: 'information-circle-outline', label: t.profile.about, onPress: handleAbout },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t.profile.title}</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>{targetLanguage.flag}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{targetLanguage.name} {t.profile.learner}</Text>
            <Text style={styles.userLevel}>{t.profile.level} {stats.level}</Text>
          </View>
          <View style={styles.userStats}>
            <View style={styles.userStatItem}>
              <Text style={styles.userStatValue}>{stats.streak}</Text>
              <Text style={styles.userStatLabel}>🔥</Text>
            </View>
            <View style={styles.userStatItem}>
              <Text style={styles.userStatValue}>{stats.xp}</Text>
              <Text style={styles.userStatLabel}>XP</Text>
            </View>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.profile.settings}</Text>
          <View style={styles.settingsList}>
            {settingsItems.map((item, idx) => {
              const isDisabled = 'disabled' in item && item.disabled;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.settingsItem,
                    idx === settingsItems.length - 1 && styles.settingsItemLast,
                    isDisabled && styles.settingsItemDisabled,
                  ]}
                  onPress={item.type === 'nav' && !isDisabled ? item.onPress : undefined}
                  activeOpacity={item.type === 'toggle' || isDisabled ? 1 : 0.7}
                  disabled={isDisabled}
                >
                  <View style={styles.settingsItemLeft}>
                    <Ionicons
                      name={item.icon as any}
                      size={22}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.settingsItemLabel}>{item.label}</Text>
                  </View>
                  {item.type === 'toggle' ? (
                    <Switch
                      value={item.toggleValue}
                      onValueChange={item.onToggle}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.white}
                    />
                  ) : (
                    <View style={styles.settingsItemRight}>
                      <Text style={styles.settingsItemValue}>{item.value}</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.textMuted}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Debug Section (Dev Only) */}
        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.profile.debugTools}</Text>
            <View style={styles.settingsList}>
              <TouchableOpacity
                style={[styles.settingsItem, styles.settingsItemLast]}
                onPress={() => {
                  debugSimulateFading();
                  Alert.alert('Debug', 'All words are now due for review. Check the Map or Progress tab.');
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="flash" size={22} color="#F59E0B" />
                  <Text style={styles.settingsItemLabel}>{t.profile.simulateFading}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.profile.subscription}</Text>
          <View style={styles.settingsList}>
            <TouchableOpacity
              style={[styles.settingsItem, styles.settingsItemLast]}
              onPress={handleManageSubscription}
            >
              <View style={styles.settingsItemLeft}>
                <View style={[styles.premiumIcon, isPremium && styles.premiumIconActive]}>
                  <Ionicons
                    name="star"
                    size={18}
                    color={isPremium ? colors.white : colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.settingsItemLabel}>
                    {isPremium ? t.profile.premium : t.profile.upgradeToPremium}
                  </Text>
                  <Text style={styles.subscriptionSubtext}>
                    {isPremium ? t.profile.manageSubscription : t.profile.unlimitedPhotos}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* More Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.profile.more}</Text>
          <View style={styles.settingsList}>
            {moreItems.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.settingsItem,
                  idx === moreItems.length - 1 && styles.settingsItemLast,
                ]}
                onPress={item.onPress}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons
                    name={item.icon as any}
                    size={22}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.settingsItemLabel}>{item.label}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Version */}
        <Text style={styles.version}>Genkochi v1.0.0</Text>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={modalMode === 'native' || modalMode === 'target'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalMode(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {modalMode === 'native' ? t.profile.myLanguage : t.profile.learning}
            </Text>
            <TouchableOpacity
              onPress={() => setModalMode(null)}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.languageList}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          >
            {languageOptions.map((lang) => {
              const isSelected = modalMode === 'native'
                ? nativeLanguage.code === lang.code
                : targetLanguage.code === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageItem,
                    isSelected && styles.languageItemSelected,
                  ]}
                  onPress={() => handleSelectLanguage(lang)}
                >
                  <Text style={styles.languageFlag}>{lang.flag}</Text>
                  <View style={styles.languageInfo}>
                    <Text style={styles.languageName}>{lang.name}</Text>
                    <Text style={styles.languageNative}>{lang.nativeName}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Learning Goal Picker Modal */}
      <Modal
        visible={modalMode === 'goal'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalMode(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.profile.learningGoal}</Text>
            <TouchableOpacity
              onPress={() => setModalMode(null)}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.languageList}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          >
            {LEARNING_GOALS.map((goal) => {
              const isSelected = learningGoal === goal.id;
              return (
                <TouchableOpacity
                  key={goal.id}
                  style={[
                    styles.languageItem,
                    isSelected && styles.languageItemSelected,
                  ]}
                  onPress={() => handleSelectGoal(goal.id)}
                >
                  <Text style={styles.languageFlag}>{goal.emoji}</Text>
                  <View style={styles.languageInfo}>
                    <Text style={styles.languageName}>{goal.title}</Text>
                    <Text style={styles.languageNative}>{goal.subtitle}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        visible={modalMode === 'time'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalMode(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.profile.dailyReminderTime}</Text>
            <TouchableOpacity
              onPress={() => setModalMode(null)}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.languageList}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          >
            <Text style={styles.timePickerLabel}>
              {t.profile.chooseReminderTime}
            </Text>
            {/* Common times */}
            {[
              { hour: 7, minute: 0, label: t.profile.morning, emoji: '🌅' },
              { hour: 12, minute: 0, label: t.profile.noon, emoji: '☀️' },
              { hour: 17, minute: 0, label: t.profile.evening, emoji: '🌆' },
              { hour: 19, minute: 0, label: t.profile.night, emoji: '🌙' },
              { hour: 21, minute: 0, label: t.profile.beforeBed, emoji: '😴' },
            ].map((time) => {
              const isSelected = reminderHour === time.hour && reminderMinute === time.minute;
              return (
                <TouchableOpacity
                  key={`${time.hour}-${time.minute}`}
                  style={[
                    styles.languageItem,
                    isSelected && styles.languageItemSelected,
                  ]}
                  onPress={() => handleTimeSelect(time.hour, time.minute)}
                >
                  <Text style={styles.languageFlag}>{time.emoji}</Text>
                  <View style={styles.languageInfo}>
                    <Text style={styles.languageName}>{time.label}</Text>
                    <Text style={styles.languageNative}>
                      {formatTime(time.hour, time.minute)}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.xxl,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // User Card
  userCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: typography.lg,
    fontWeight: '700',
  },
  userLevel: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    marginTop: 2,
  },
  userStats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  userStatItem: {
    alignItems: 'center',
  },
  userStatValue: {
    color: colors.textPrimary,
    fontSize: typography.lg,
    fontWeight: '700',
  },
  userStatLabel: {
    color: colors.textMuted,
    fontSize: typography.xs,
  },

  // Upgrade Button
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
    gap: spacing.sm,
    ...shadows.md,
  },
  upgradeButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: '600',
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  settingsList: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  settingsItemLast: {
    borderBottomWidth: 0,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingsItemLabel: {
    color: colors.textPrimary,
    fontSize: typography.base,
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settingsItemValue: {
    color: colors.textMuted,
    fontSize: typography.sm,
  },

  // Premium/Subscription styles
  premiumIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumIconActive: {
    backgroundColor: colors.primary,
  },
  subscriptionSubtext: {
    color: colors.textMuted,
    fontSize: typography.xs,
    marginTop: 2,
  },

  version: {
    color: colors.textMuted,
    fontSize: typography.sm,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: '700',
  },
  modalClose: {
    padding: spacing.xs,
  },
  languageList: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  languageItemSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  languageFlag: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    color: colors.textPrimary,
    fontSize: typography.base,
    fontWeight: '600',
  },
  languageNative: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    marginTop: 2,
  },
  timePickerLabel: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  settingsItemDisabled: {
    opacity: 0.5,
  },
});

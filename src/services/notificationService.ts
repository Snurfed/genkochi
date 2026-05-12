import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  LAST_PRACTICE_DATE: 'last-practice-date',
  REMINDER_HOUR: 'reminder-hour',
  REMINDER_MINUTE: 'reminder-minute',
};

// Notification identifiers
const NOTIFICATION_IDS = {
  DAILY_REMINDER: 'daily-reminder',
  STREAK_PROTECTION: 'streak-protection',
  MEMORY_FADING: 'memory-fading',
};

export interface NotificationSettings {
  enabled: boolean;
  reminderHour: number;
  reminderMinute: number;
}

const DEFAULT_REMINDER_HOUR = 19;
const DEFAULT_REMINDER_MINUTE = 0;

class NotificationService {
  private initialized = false;

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Genkochi Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#7C3AED',
        });
      }

      this.initialized = true;
      if (__DEV__) console.log('[Notifications] Initialized successfully');
      return true;
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Initialization error:', error);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    try {
      await this.initialize();
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      if (existingStatus === 'granted') {
        return true;
      }

      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Permission request error:', error);
      return false;
    }
  }

  async hasPermission(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Permission check error:', error);
      return false;
    }
  }

  async getSettings(): Promise<NotificationSettings> {
    try {
      const enabled = await this.hasPermission();
      const hourStr = await AsyncStorage.getItem(STORAGE_KEYS.REMINDER_HOUR);
      const minuteStr = await AsyncStorage.getItem(STORAGE_KEYS.REMINDER_MINUTE);

      return {
        enabled,
        reminderHour: hourStr ? parseInt(hourStr, 10) : DEFAULT_REMINDER_HOUR,
        reminderMinute: minuteStr ? parseInt(minuteStr, 10) : DEFAULT_REMINDER_MINUTE,
      };
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Error getting settings:', error);
      return {
        enabled: false,
        reminderHour: DEFAULT_REMINDER_HOUR,
        reminderMinute: DEFAULT_REMINDER_MINUTE,
      };
    }
  }

  async setReminderTime(hour: number, minute: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REMINDER_HOUR, hour.toString());
      await AsyncStorage.setItem(STORAGE_KEYS.REMINDER_MINUTE, minute.toString());
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Error saving reminder time:', error);
    }
  }

  async scheduleDailyReminder(
    hour: number,
    minute: number,
    targetLanguage: string
  ): Promise<void> {
    try {
      await this.initialize();
      await this.cancelDailyReminder();

      const hasPermission = await this.hasPermission();
      if (!hasPermission) {
        if (__DEV__) console.log('[Notifications] No permission for daily reminder');
        return;
      }

      await this.setReminderTime(hour, minute);

      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_IDS.DAILY_REMINDER,
        content: {
          title: `Time to practice ${targetLanguage}!`,
          body: "Just 5 minutes keeps your skills sharp. Let's learn something new!",
          sound: true,
          badge: 1,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });

      if (__DEV__) console.log(`[Notifications] Daily reminder scheduled for ${hour}:${minute.toString().padStart(2, '0')}`);
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Schedule daily reminder error:', error);
    }
  }

  async cancelDailyReminder(): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.DAILY_REMINDER);
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Cancel daily reminder error:', error);
    }
  }

  async scheduleStreakProtection(
    streak: number,
    targetLanguage: string
  ): Promise<void> {
    try {
      await this.initialize();
      await this.cancelStreakProtection();

      const hasPermission = await this.hasPermission();
      if (!hasPermission || streak === 0) return;

      const now = new Date();
      const triggerDate = new Date();
      triggerDate.setHours(20, 0, 0, 0);

      if (now >= triggerDate) {
        triggerDate.setDate(triggerDate.getDate() + 1);
      }

      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_IDS.STREAK_PROTECTION,
        content: {
          title: `Don't lose your ${streak}-day streak!`,
          body: `You're doing great with ${targetLanguage}. A quick practice will keep your streak alive!`,
          sound: true,
          badge: 1,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });

      if (__DEV__) console.log(`[Notifications] Streak protection scheduled for ${triggerDate.toLocaleString()}`);
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Schedule streak protection error:', error);
    }
  }

  async cancelStreakProtection(): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.STREAK_PROTECTION);
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Cancel streak protection error:', error);
    }
  }

  async sendStreakCelebration(streak: number): Promise<void> {
    try {
      await this.initialize();
      const hasPermission = await this.hasPermission();
      if (!hasPermission) return;

      const milestones = [3, 7, 14, 30, 50, 100, 200, 365];
      if (!milestones.includes(streak)) return;

      let title = '';
      let body = '';

      switch (streak) {
        case 3:
          title = "3-day streak! You're building a habit!";
          body = "Keep it up - consistency is key to language learning.";
          break;
        case 7:
          title = "One week streak! Amazing!";
          body = "You've made it a whole week. You're on fire!";
          break;
        case 14:
          title = "Two weeks strong!";
          body = "Your dedication is paying off. Keep going!";
          break;
        case 30:
          title = "30-day streak! Incredible!";
          body = "A full month of learning. You're truly committed!";
          break;
        case 50:
          title = "50 days! You're unstoppable!";
          body = "Half way to 100. Your progress is inspiring!";
          break;
        case 100:
          title = "100-DAY STREAK! LEGENDARY!";
          body = "You've achieved something amazing. True dedication!";
          break;
        case 200:
          title = "200 days! Master learner!";
          body = "Your commitment is extraordinary. Keep shining!";
          break;
        case 365:
          title = "ONE YEAR STREAK! CHAMPION!";
          body = "365 days of learning. You're absolutely incredible!";
          break;
        default:
          return;
      }

      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true },
        trigger: null,
      });
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Send streak celebration error:', error);
    }
  }

  async scheduleMemoryFadingReminder(
    fadingCount: number,
    targetLanguage: string
  ): Promise<void> {
    try {
      await this.initialize();
      await this.cancelMemoryFadingReminder();

      const hasPermission = await this.hasPermission();
      if (!hasPermission || fadingCount === 0) return;

      // Schedule for tomorrow morning at 9am
      const triggerDate = new Date();
      triggerDate.setDate(triggerDate.getDate() + 1);
      triggerDate.setHours(9, 0, 0, 0);

      const title = fadingCount === 1
        ? 'A memory is fading!'
        : `${fadingCount} memories are fading!`;
      const body = fadingCount === 1
        ? `Your ${targetLanguage} photo is getting blurry. Quick review to keep it fresh!`
        : `Your ${targetLanguage} photos need attention. A quick review will restore them!`;

      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_IDS.MEMORY_FADING,
        content: {
          title,
          body,
          sound: true,
          badge: fadingCount,
          data: { type: 'memory-fading', count: fadingCount },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });

      if (__DEV__) console.log(`[Notifications] Memory fading reminder scheduled for ${triggerDate.toLocaleString()}`);
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Schedule memory fading error:', error);
    }
  }

  async cancelMemoryFadingReminder(): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.MEMORY_FADING);
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Cancel memory fading error:', error);
    }
  }

  async recordPractice(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_PRACTICE_DATE, today);
      await this.cancelStreakProtection();
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Record practice error:', error);
    }
  }

  async hasPracticedToday(): Promise<boolean> {
    try {
      const lastPractice = await AsyncStorage.getItem(STORAGE_KEYS.LAST_PRACTICE_DATE);
      const today = new Date().toISOString().split('T')[0];
      return lastPractice === today;
    } catch {
      return false;
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (__DEV__) console.log('[Notifications] All notifications cancelled');
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Cancel all notifications error:', error);
    }
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      if (__DEV__) console.log('[Notifications] Get scheduled notifications error:', error);
      return [];
    }
  }

  formatTime(hour: number, minute: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
  }
}

export const notificationService = new NotificationService();
export default notificationService;

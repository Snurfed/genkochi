import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../src/constants/design';
import { useAppStore } from '../src/store';
import { useSubscriptionStore } from '../src/store/subscriptionStore';
import { purchaseService } from '../src/services/purchaseService';
import { notificationService } from '../src/services/notificationService';
import { Paywall } from '../src/components/Paywall';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const { hasCompletedOnboarding, calculateMemoryDecay, getFadingMemories, targetLanguage } = useAppStore();
  const [isReady, setIsReady] = useState(false);

  // Calculate memory decay and schedule notifications on app startup
  useEffect(() => {
    calculateMemoryDecay();
    // Schedule fading memory notifications
    const fadingCount = getFadingMemories().length;
    if (fadingCount > 0) {
      notificationService.scheduleMemoryFadingReminder(fadingCount, targetLanguage.name);
    }
  }, []);

  useEffect(() => {
    // Small delay to ensure store is hydrated from persistence
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inOnboarding = segments[0] === 'onboarding';

    if (!hasCompletedOnboarding && !inOnboarding) {
      // Redirect to onboarding if not completed
      router.replace('/onboarding');
    } else if (hasCompletedOnboarding && inOnboarding) {
      // Redirect to main app if already completed onboarding
      router.replace('/');
    }
  }, [hasCompletedOnboarding, segments, isReady]);

  return isReady;
}

export default function RootLayout() {
  const isReady = useProtectedRoute();
  const { paywallVisible, paywallContext, hidePaywall } = useSubscriptionStore();

  // Initialize RevenueCat for in-app purchases
  useEffect(() => {
    purchaseService.initialize();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="translate" options={{ presentation: 'card' }} />
        <Stack.Screen name="saved-translations" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        <Stack.Screen name="character-practice" options={{ presentation: 'card' }} />
        <Stack.Screen name="kana-practice" options={{ presentation: 'card' }} />
        <Stack.Screen name="quick-review" options={{ presentation: 'modal' }} />
        <Stack.Screen name="achievements" options={{ presentation: 'card' }} />
      </Stack>
      <Paywall
        visible={paywallVisible}
        onClose={hidePaywall}
        trigger={paywallContext?.trigger}
      />
    </ErrorBoundary>
  );
}

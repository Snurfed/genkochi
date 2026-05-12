import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, borderRadius, spacing, shadows } from '../../constants/design';

// Check if running in Expo Go (blur not fully supported)
const isExpoGo = Constants.appOwnership === 'expo';

// Wrapper that uses solid background in Expo Go, blur otherwise
function CardBackground({ intensity, children, style }: { intensity: number; children: React.ReactNode; style: any }) {
  // Use solid background in Expo Go or web (blur not supported)
  if (isExpoGo || Platform.OS === 'web') {
    return (
      <View style={[style, styles.solidBackground]}>
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint="light" style={style}>
      {children}
    </BlurView>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 0; // Full screen - no offset

interface FloatingCardProps {
  children: React.ReactNode;
  onClose: () => void;
  position?: 'bottom' | 'center';
  showCloseButton?: boolean;
  intensity?: number;
  scrollEnabled?: boolean;
}

/**
 * FloatingCard - Base glassmorphism card that floats over the photo
 * Supports swipe down to dismiss and tap outside to close
 */
export function FloatingCard({
  children,
  onClose,
  position = 'center',
  showCloseButton = true,
  intensity = 80,
  scrollEnabled = true,
}: FloatingCardProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  // Full screen - only respect safe areas
  const topOffset = insets.top; // Just safe area, no extra padding
  const bottomOffset = insets.bottom; // Just safe area for home indicator

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const animateOut = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const handleClose = () => {
    animateOut(onClose);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // ONLY handle swipe-to-dismiss from the drag handle area (top 40px)
        // This prevents stealing gestures from child components like FlickKeyboard
        const touchY = evt.nativeEvent.locationY;
        const isInDragHandle = touchY < 40;
        const isSignificantDownSwipe = gestureState.dy > 15;
        // Must be in drag handle AND swiping down
        return isInDragHandle && isSignificantDownSwipe;
      },
      // Never capture - let children handle gestures first
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy * 0.5);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          handleClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
      // Allow children to take over if needed
      onPanResponderTerminationRequest: () => true,
    })
  ).current;

  return (
    <Modal
      visible={true}
      animationType="none"
      transparent={false}
      statusBarTranslucent
      presentationStyle="fullScreen"
    >
      <StatusBar barStyle="dark-content" />
      <Animated.View
        style={[
          styles.cardContainer,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <CardBackground intensity={intensity} style={styles.blurView}>
          {/* Safe area padding for Dynamic Island / notch */}
          <View style={{ height: insets.top }} />

          {/* Close button - positioned in safe area */}
          {showCloseButton && (
            <TouchableOpacity
              style={[styles.closeButton, { top: insets.top + 8 }]}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Scrollable content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
            scrollEnabled={scrollEnabled}
          >
            {children}
          </ScrollView>
        </CardBackground>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  blurView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  solidBackground: {
    backgroundColor: '#FFFFFF',
  },
  dragHandle: {
    display: 'none', // Not used in full screen mode
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    flexGrow: 1,
  },
});

export default FloatingCard;

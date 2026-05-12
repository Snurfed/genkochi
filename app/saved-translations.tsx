import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../src/constants/design';
import { useAppStore } from '../src/store';
import { speakJapanese } from '../src/utils/speech';
import { SavedTranslation } from '../src/types';

export default function SavedTranslationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    savedTranslations,
    deleteTranslation,
    toggleFavorite,
    getFavoriteTranslations,
  } = useAppStore();

  const [filter, setFilter] = useState<'all' | 'favorites'>('all');

  const displayedTranslations = filter === 'favorites'
    ? getFavoriteTranslations()
    : savedTranslations;

  const handleDelete = (id: string) => {
    Alert.alert('Delete?', 'Remove this phrase?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTranslation(id) },
    ]);
  };

  const handleSpeak = (item: SavedTranslation) => {
    const textToSpeak = item.targetLanguage === 'ja' ? item.targetText : item.sourceText;
    speakJapanese(textToSpeak);
  };

  const renderItem = (item: SavedTranslation) => (
    <TouchableOpacity
      key={item.id}
      style={styles.card}
      onPress={() => handleSpeak(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardMain}>
        <Text style={styles.cardSource} numberOfLines={1}>{item.sourceText}</Text>
        <Text style={styles.cardTarget}>{item.targetText}</Text>
        {item.romaji && (
          <Text style={styles.cardRomaji}>{item.romaji}</Text>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.cardAction}
          onPress={() => handleSpeak(item)}
        >
          <Ionicons name="volume-high" size={20} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cardAction}
          onPress={() => toggleFavorite(item.id)}
        >
          <Ionicons
            name={item.isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={item.isFavorite ? colors.primary : colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cardAction}
          onPress={() => handleDelete(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Phrases</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{savedTranslations.length}</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'favorites' && styles.filterTabActive]}
          onPress={() => setFilter('favorites')}
        >
          <Ionicons
            name="heart"
            size={14}
            color={filter === 'favorites' ? colors.white : colors.textMuted}
          />
          <Text style={[styles.filterText, filter === 'favorites' && styles.filterTextActive]}>
            Favorites
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {displayedTranslations.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {filter === 'favorites' ? 'No favorites yet' : 'No saved phrases'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'favorites'
                ? 'Tap the heart to add favorites'
                : 'Translate and save phrases to build your collection'}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/translate')}
            >
              <Ionicons name="language" size={20} color={colors.white} />
              <Text style={styles.emptyButtonText}>Start Translating</Text>
            </TouchableOpacity>
          </View>
        ) : (
          displayedTranslations.map(renderItem)
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push('/translate')}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
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
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  countText: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: '600',
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.white,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },

  // Card
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardMain: {
    marginBottom: spacing.sm,
  },
  cardSource: {
    color: colors.textMuted,
    fontSize: typography.sm,
    marginBottom: spacing.xs,
  },
  cardTarget: {
    color: colors.white,
    fontSize: typography.xl,
    fontWeight: '600',
  },
  cardRomaji: {
    color: colors.primary,
    fontSize: typography.sm,
    marginTop: spacing.xs,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  cardAction: {
    padding: spacing.sm,
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: typography.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: '600',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

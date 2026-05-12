import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../../src/constants/design';
import { useAppStore } from '../../src/store';
import { speakJapanese } from '../../src/utils/speech';
import { SavedTranslation } from '../../src/types';

export default function PhrasesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    savedTranslations,
    deleteTranslation,
    toggleFavorite,
    getFavoriteTranslations,
    lessons,
  } = useAppStore();

  const [filter, setFilter] = useState<'all' | 'favorites' | 'photos'>('all');

  // Get words from photos
  const photoWords = lessons.flatMap(l =>
    l.words.map(w => ({
      id: w.id,
      sourceText: w.english,
      targetText: w.japanese,
      reading: w.reading,
      romaji: w.romaji,
      source: 'photo' as const,
      photoUri: l.imageUri,
      isFavorite: false,
    }))
  ).slice(0, 20);

  const getDisplayedItems = () => {
    if (filter === 'favorites') return getFavoriteTranslations();
    if (filter === 'photos') return photoWords;
    return savedTranslations;
  };

  const displayedItems = getDisplayedItems();

  const handleSpeak = (item: any) => {
    speakJapanese(item.targetText);
  };

  const handleDelete = (id: string) => {
    if (filter === 'photos') return; // Can't delete photo words from here
    Alert.alert('Delete?', 'Remove this phrase?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTranslation(id) },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Phrases</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/translate')}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statPill}>
          <Ionicons name="bookmark" size={14} color={colors.mint} />
          <Text style={styles.statText}>{savedTranslations.length} saved</Text>
        </View>
        <View style={styles.statPill}>
          <Ionicons name="heart" size={14} color={colors.primary} />
          <Text style={styles.statText}>{getFavoriteTranslations().length} favorites</Text>
        </View>
        <View style={styles.statPill}>
          <Ionicons name="camera" size={14} color={colors.xp} />
          <Text style={styles.statText}>{photoWords.length} from photos</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: 'Translations', icon: 'language' },
          { key: 'favorites', label: 'Favorites', icon: 'heart' },
          { key: 'photos', label: 'From Photos', icon: 'camera' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => setFilter(tab.key as any)}
          >
            <Ionicons
              name={tab.icon as any}
              size={14}
              color={filter === tab.key ? colors.white : colors.textMuted}
            />
            <Text style={[styles.filterText, filter === tab.key && styles.filterTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {displayedItems.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {filter === 'favorites' ? 'No favorites yet' :
               filter === 'photos' ? 'No words from photos' :
               'No saved phrases'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'favorites' ? 'Tap the heart to add favorites' :
               filter === 'photos' ? 'Capture photos to learn new words' :
               'Translate and save phrases'}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push(filter === 'photos' ? '/' : '/translate')}
            >
              <Ionicons
                name={filter === 'photos' ? 'camera' : 'language'}
                size={20}
                color={colors.white}
              />
              <Text style={styles.emptyButtonText}>
                {filter === 'photos' ? 'Capture Words' : 'Start Translating'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          displayedItems.map((item: any) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => handleSpeak(item)}
              activeOpacity={0.8}
            >
              <View style={styles.cardMain}>
                <Text style={styles.cardSource} numberOfLines={1}>
                  {item.sourceText}
                </Text>
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

                {filter !== 'photos' && (
                  <>
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
                  </>
                )}
              </View>

              {item.source === 'photo' && (
                <View style={styles.sourceBadge}>
                  <Ionicons name="camera" size={10} color={colors.textMuted} />
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 100 }]}
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
  headerTitle: {
    color: colors.white,
    fontSize: typography.xxl,
    fontWeight: '800',
  },
  addButton: {
    padding: spacing.sm,
  },

  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statText: {
    color: colors.textMuted,
    fontSize: typography.xs,
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
    paddingBottom: 150,
  },

  // Card
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    position: 'relative',
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
  sourceBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
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

/**
 * MapWorldView.tsx
 *
 * A map-based world view that shows photos at their GPS locations.
 * Users can zoom/pan to discover where they took photos.
 */

import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import { WorldObject as WorldObjectType } from '../../types';
import { colors, borderRadius, spacing } from '../../constants/design';
import { getRegionForCoordinates } from '../../utils/location';
import { resolveImageUri } from '../../utils/photoStorage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MapWorldViewProps {
  objects: WorldObjectType[];
  selectedObjectId: string | null;
  onObjectPress: (object: WorldObjectType) => void;
}

// Cluster nearby markers when zoomed out
interface Cluster {
  id: string;
  latitude: number;
  longitude: number;
  objects: WorldObjectType[];
}

const CLUSTER_RADIUS_KM = 0.5; // Cluster markers within 500m

export function MapWorldView({
  objects,
  selectedObjectId,
  onObjectPress,
}: MapWorldViewProps) {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region | null>(null);

  // Filter objects with coordinates
  const objectsWithLocation = useMemo(() => {
    return objects.filter(obj => obj.coordinates?.latitude && obj.coordinates?.longitude);
  }, [objects]);

  // Calculate initial region based on all objects
  const initialRegion = useMemo(() => {
    const coords = objectsWithLocation.map(obj => ({
      latitude: obj.coordinates!.latitude,
      longitude: obj.coordinates!.longitude,
    }));
    return getRegionForCoordinates(coords);
  }, [objectsWithLocation]);

  // Cluster markers based on zoom level
  const clusters = useMemo((): Cluster[] => {
    if (!region || objectsWithLocation.length === 0) {
      // No clustering, return individual markers
      return objectsWithLocation.map(obj => ({
        id: obj.id,
        latitude: obj.coordinates!.latitude,
        longitude: obj.coordinates!.longitude,
        objects: [obj],
      }));
    }

    // Determine cluster radius based on zoom
    const zoomLevel = Math.log2(360 / region.longitudeDelta);
    const shouldCluster = zoomLevel < 14;

    if (!shouldCluster) {
      return objectsWithLocation.map(obj => ({
        id: obj.id,
        latitude: obj.coordinates!.latitude,
        longitude: obj.coordinates!.longitude,
        objects: [obj],
      }));
    }

    // Simple clustering algorithm
    const clustered: Cluster[] = [];
    const used = new Set<string>();

    for (const obj of objectsWithLocation) {
      if (used.has(obj.id)) continue;

      const cluster: Cluster = {
        id: `cluster-${obj.id}`,
        latitude: obj.coordinates!.latitude,
        longitude: obj.coordinates!.longitude,
        objects: [obj],
      };
      used.add(obj.id);

      // Find nearby objects
      for (const other of objectsWithLocation) {
        if (used.has(other.id)) continue;

        const distance = getDistance(
          obj.coordinates!.latitude,
          obj.coordinates!.longitude,
          other.coordinates!.latitude,
          other.coordinates!.longitude
        );

        // Cluster radius increases when zoomed out
        const clusterRadius = CLUSTER_RADIUS_KM * Math.pow(2, 14 - zoomLevel);

        if (distance < clusterRadius) {
          cluster.objects.push(other);
          used.add(other.id);
        }
      }

      // Recalculate cluster center
      if (cluster.objects.length > 1) {
        cluster.latitude = cluster.objects.reduce((sum, o) => sum + o.coordinates!.latitude, 0) / cluster.objects.length;
        cluster.longitude = cluster.objects.reduce((sum, o) => sum + o.coordinates!.longitude, 0) / cluster.objects.length;
      }

      clustered.push(cluster);
    }

    return clustered;
  }, [objectsWithLocation, region]);

  // Animate to selected object
  useEffect(() => {
    if (selectedObjectId && mapRef.current) {
      const obj = objectsWithLocation.find(o => o.id === selectedObjectId);
      if (obj?.coordinates) {
        mapRef.current.animateToRegion({
          latitude: obj.coordinates.latitude,
          longitude: obj.coordinates.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 500);
      }
    }
  }, [selectedObjectId, objectsWithLocation]);

  const handleRegionChange = useCallback((newRegion: Region) => {
    setRegion(newRegion);
  }, []);

  const handleClusterPress = useCallback((cluster: Cluster) => {
    if (cluster.objects.length === 1) {
      onObjectPress(cluster.objects[0]);
    } else {
      // Zoom in to show individual markers
      const coords = cluster.objects.map(obj => ({
        latitude: obj.coordinates!.latitude,
        longitude: obj.coordinates!.longitude,
      }));
      const zoomedRegion = getRegionForCoordinates(coords);
      mapRef.current?.animateToRegion(zoomedRegion, 300);
    }
  }, [onObjectPress]);

  // Empty state
  if (objectsWithLocation.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>📍</Text>
        <Text style={styles.emptyTitle}>No locations yet</Text>
        <Text style={styles.emptyText}>
          Take photos to add them to your map
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        mapType="standard"
      >
        {clusters.map(cluster => (
          <Marker
            key={cluster.id}
            coordinate={{
              latitude: cluster.latitude,
              longitude: cluster.longitude,
            }}
            onPress={() => handleClusterPress(cluster)}
          >
            {cluster.objects.length === 1 ? (
              <PhotoMarker
                object={cluster.objects[0]}
                isSelected={cluster.objects[0].id === selectedObjectId}
              />
            ) : (
              <ClusterMarker count={cluster.objects.length} />
            )}
          </Marker>
        ))}
      </MapView>

      {/* Map controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            mapRef.current?.animateToRegion(initialRegion, 500);
          }}
        >
          <Text style={styles.controlIcon}>🎯</Text>
        </TouchableOpacity>
      </View>

      {/* Object count */}
      <View style={styles.countBadge}>
        <Text style={styles.countText}>
          {objectsWithLocation.length} {objectsWithLocation.length === 1 ? 'word' : 'words'}
        </Text>
      </View>
    </View>
  );
}

// Individual photo marker
function PhotoMarker({
  object,
  isSelected,
}: {
  object: WorldObjectType;
  isSelected: boolean;
}) {
  return (
    <View style={[styles.markerContainer, isSelected && styles.markerSelected]}>
      {object.photoUri ? (
        <Image
          source={{ uri: resolveImageUri(object.photoUri) }}
          style={styles.markerImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.markerEmoji}>
          <Text style={styles.markerEmojiText}>{object.emoji}</Text>
        </View>
      )}
      <View style={styles.markerLabel}>
        <Text style={styles.markerLabelText} numberOfLines={1}>
          {object.displayName}
        </Text>
      </View>
      {object.needsReview && (
        <View style={styles.reviewDot} />
      )}
    </View>
  );
}

// Cluster marker showing count
function ClusterMarker({ count }: { count: number }) {
  return (
    <View style={styles.clusterContainer}>
      <Text style={styles.clusterCount}>{count}</Text>
    </View>
  );
}

// Calculate distance between two points in km
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Markers
  markerContainer: {
    alignItems: 'center',
  },
  markerSelected: {
    transform: [{ scale: 1.15 }],
  },
  markerImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerEmoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerEmojiText: {
    fontSize: 24,
  },
  markerLabel: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    maxWidth: 80,
  },
  markerLabelText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  reviewDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
  },

  // Clusters
  clusterContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterCount: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // Controls
  controls: {
    position: 'absolute',
    bottom: 100,
    right: spacing.md,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: spacing.sm,
  },
  controlIcon: {
    fontSize: 20,
  },

  // Count badge
  countBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  countText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default MapWorldView;

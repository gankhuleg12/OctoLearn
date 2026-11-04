import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Unit } from '@/api/types';
import { TopBar } from '@/components/pathway/top-bar';
import { UnitHeader } from '@/components/pathway/unit-header';
import { UnitMap } from '@/components/pathway/unit-map';
import { ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { showToast } from '@/components/ui/toast';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLearning } from '@/store/learning';

function warnLocked(message: string) {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  showToast(message, 'locked');
}

interface UnitSectionProps {
  unit: Unit;
  index: number;
  /** y of the map inside the section */
  onNodesLayout: (y: number) => void;
  /** y of a node (lesson or quiz) inside the map */
  onNodeLayout: (nodeId: string, y: number) => void;
}

function UnitSection({ unit, index, onNodesLayout, onNodeLayout }: UnitSectionProps) {
  return (
    <View>
      {/* The banner sits over the top edge of its map region like a signpost. */}
      <View style={styles.header}>
        <UnitHeader unit={unit} index={index} />
      </View>
      <View onLayout={(e) => onNodesLayout(e.nativeEvent.layout.y)}>
        <UnitMap
          unit={unit}
          index={index}
          onNodeLayout={onNodeLayout}
          onPressNode={(node) => {
            if (node.state === 'locked') {
              warnLocked(
                node.kind === 'quiz'
                  ? `Бүлгийн ${unit.lessons.length} хичээлээ дуусгавал шалгалт нээгдэнэ.`
                  : 'Өмнөх хичээлээ эхлээд дуусгана уу.',
              );
            } else if (node.kind === 'quiz') {
              router.push({ pathname: '/quiz/[id]', params: { id: node.id } });
            } else {
              router.push({ pathname: '/lesson/[id]', params: { id: node.id } });
            }
          }}
        />
      </View>
    </View>
  );
}

export default function PathwayScreen() {
  const t = useTheme();
  const pathway = useLearning((s) => s.pathway);
  const status = useLearning((s) => s.pathwayStatus);
  const error = useLearning((s) => s.pathwayError);
  const offline = useLearning((s) => s.offline);
  const loadPathway = useLearning((s) => s.loadPathway);

  const scrollRef = useRef<ScrollViewInstance>(null);
  // Layout measurements for auto-scroll. onLayout order is not guaranteed, so
  // every offset is recorded and the scroll happens once all are known.
  const layout = useRef({
    unitY: {} as Record<string, number>,
    nodesY: {} as Record<string, number>,
    nodeY: {} as Record<string, number>,
  });
  // Id of the active node we last scrolled to (cached data may show an older one first).
  const scrolledTo = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const active = pathway?.activeNode ?? null;

  useEffect(() => {
    loadPathway();
  }, [loadPathway]);

  // Light status-bar text over the purple top bar; restore when leaving the tab.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(t.scheme === 'dark' ? 'light' : 'dark');
    }, [t.scheme]),
  );

  async function refresh() {
    setRefreshing(true);
    await loadPathway();
    setRefreshing(false);
  }

  // P1: bring the active node into view on open and whenever it moves on.
  const tryAutoScroll = useCallback(() => {
    if (!active || scrolledTo.current === active.id) return;
    const { unitY, nodesY, nodeY } = layout.current;
    const parts = [unitY[active.unitId], nodesY[active.unitId], nodeY[active.id]];
    if (parts.some((p) => p == null)) return;
    scrolledTo.current = active.id;
    const y = parts.reduce((a, b) => a! + b!, 0)!;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 180), animated: true }));
  }, [active]);

  useEffect(() => {
    tryAutoScroll();
  }, [tryAutoScroll]);

  if (!pathway) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        {status === 'error' ? (
          <ErrorView message={error ?? 'Өгөгдөл ачаалагдсангүй.'} onRetry={loadPathway} />
        ) : (
          <LoadingView label="Сургалтын замыг ачаалж байна…" />
        )}
      </SafeAreaView>
    );
  }

  const finished = pathway.activeNode === null && pathway.units.length > 0;

  return (
    <SafeAreaView edges={[]} style={[styles.safe, { backgroundColor: t.background }]}>
      <TopBar summary={pathway.summary} courseTitle={pathway.course.title} />
      {offline && (
        <View style={[styles.banner, { backgroundColor: t.surfaceStrong }]} accessibilityRole="alert">
          <Ionicons name="cloud-offline" size={16} color={t.textSecondary} />
          <Text variant="caption" color="textSecondary">
            Офлайн байна — хадгалсан ахицыг харуулж байна.
          </Text>
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.purple} colors={[t.purple]} />}>
        <View style={styles.column}>
          {pathway.units.length === 0 ? (
            <Text color="textSecondary" center>
              Одоогоор хичээл нэмэгдээгүй байна.
            </Text>
          ) : (
            pathway.units.map((unit, i) => (
              <View
                key={unit.id}
                onLayout={(e) => {
                  layout.current.unitY[unit.id] = e.nativeEvent.layout.y;
                  tryAutoScroll();
                }}>
                <UnitSection
                  unit={unit}
                  index={i}
                  onNodesLayout={(y) => {
                    layout.current.nodesY[unit.id] = y;
                    tryAutoScroll();
                  }}
                  onNodeLayout={(id, y) => {
                    layout.current.nodeY[id] = y;
                    tryAutoScroll();
                  }}
                />
              </View>
            ))
          )}
          {finished && (
            <View style={[styles.finish, { backgroundColor: t.primarySoft }]}>
              <Text style={styles.finishEmoji}>🎉</Text>
              <Text variant="heading" center>
                Курсыг бүрэн дуусгалаа!
              </Text>
              <Text color="textSecondary" center>
                Шинэ бүлэг нэмэгдэхэд энд гарч ирнэ.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.xl },
  header: { zIndex: 2, marginHorizontal: Spacing.sm },
  finish: { borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  finishEmoji: { fontSize: 44, lineHeight: 52 },
});

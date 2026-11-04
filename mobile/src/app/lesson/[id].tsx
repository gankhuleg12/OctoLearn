import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/endpoints';
import type { CompleteLessonResult } from '@/api/types';
import { LessonVideo } from '@/components/lesson/lesson-video';
import { RewardOverlay } from '@/components/reward-overlay';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { LoadingView, MessageView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { showToast } from '@/components/ui/toast';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { findLesson } from '@/lib/pathway';
import { useLearning } from '@/store/learning';

/** "Дуусгах" unlocks once this share of the video has actually been played. */
const REQUIRED_WATCH_RATIO = 0.9;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function LessonScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pathway = useLearning((s) => s.pathway);
  const status = useLearning((s) => s.pathwayStatus);
  const recordProgress = useLearning((s) => s.recordProgress);

  const [watched, setWatched] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CompleteLessonResult | null>(null);

  const found = findLesson(pathway, id);

  if (!found) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <ScreenHeader onClose={close} />
        {status === 'loading' ? (
          <LoadingView />
        ) : (
          <MessageView icon="help-circle-outline" title="Хичээл олдсонгүй" actionLabel="Буцах" onAction={close} />
        )}
      </SafeAreaView>
    );
  }

  const { unit, lesson, index } = found;
  const unitNumber = pathway!.units.indexOf(unit) + 1;

  if (lesson.state === 'locked') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <ScreenHeader onClose={close} />
        <MessageView icon="lock-closed" title="Хичээл түгжээтэй" message="Өмнөх хичээлээ эхлээд дуусгана уу." actionLabel="Буцах" onAction={close} />
      </SafeAreaView>
    );
  }

  // Bunny uploads are 'processing' until encoded; older cached lessons have no status.
  const videoReady = (lesson.videoStatus ?? 'ready') === 'ready';
  // Bunny serves HLS; browsers other than Safari can't play it natively, so web uses the MP4 rendition.
  const videoUri = Platform.OS === 'web' && lesson.videoFallbackUrl ? lesson.videoFallbackUrl : lesson.videoUrl;
  const alreadyDone = lesson.state === 'completed';
  const canFinish = alreadyDone || watched >= REQUIRED_WATCH_RATIO;
  // floor, not round: showing "90%" while the button is still locked at 89.6% would confuse.
  const watchedPercent = Math.floor(Math.min(1, watched) * 100);

  async function finish() {
    if (alreadyDone) return close();
    setSubmitting(true);
    try {
      const res = await api.completeLesson(lesson.id);
      recordProgress(lesson.id, res.nextNode, res.summary);
      setResult(res);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScreenHeader onClose={close}>
        <Text variant="label" color="textSecondary" numberOfLines={1}>
          Бүлэг {unitNumber} · Хичээл {index + 1} / {unit.lessons.length}
        </Text>
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          {videoReady ? (
            <LessonVideo
              uri={videoUri}
              fallbackDurationSec={lesson.durationSec}
              onWatchedChange={(r) => setWatched((prev) => Math.max(prev, r))}
              paused={!!result}
            />
          ) : (
            <View style={[styles.notReady, { backgroundColor: t.surface }]}>
              <Ionicons name={lesson.videoStatus === 'error' ? 'alert-circle' : 'hourglass-outline'} size={36} color={t.textSecondary} />
              <Text variant="bodyBold" center>
                {lesson.videoStatus === 'error' ? 'Видео боловсруулахад алдаа гарлаа' : 'Видео бэлтгэгдэж байна'}
              </Text>
              <Text variant="caption" color="textSecondary" center>
                {lesson.videoStatus === 'error' ? 'Багшид мэдэгдэнэ үү.' : 'Хэдэн минутын дараа дахин ороод үзээрэй.'}
              </Text>
            </View>
          )}

          <View style={styles.texts}>
            <Text variant="title">{lesson.title}</Text>
            {lesson.description ? <Text color="textSecondary">{lesson.description}</Text> : null}
          </View>

          <View style={[styles.watchCard, { backgroundColor: t.surface }]}>
            <View style={styles.watchRow}>
              <Ionicons name={canFinish ? 'checkmark-circle' : 'eye-outline'} size={20} color={canFinish ? t.green : t.textSecondary} />
              <Text variant="bodyBold" style={{ flex: 1 }}>
                {alreadyDone ? 'Энэ хичээлийг дуусгасан' : `Үзсэн: ${watchedPercent}%`}
              </Text>
              <Text variant="caption" color="goldDark">
                ⚡ {lesson.xp} XP
              </Text>
            </View>
            {!alreadyDone && <ProgressBar percent={watchedPercent} color={t.purple} height={10} accessibilityLabel="Видео үзсэн хувь" />}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <View style={styles.column}>
          {!canFinish && (
            <Text variant="caption" color="textSecondary" center>
              Видеоны {Math.round(REQUIRED_WATCH_RATIO * 100)}%-ийг үзсэний дараа идэвхжинэ
            </Text>
          )}
          <Button
            title={alreadyDone ? 'Буцах' : 'Дуусгах'}
            variant={canFinish ? 'success' : 'primary'}
            disabled={!canFinish}
            loading={submitting}
            onPress={finish}
          />
        </View>
      </View>

      {result && (
        <RewardOverlay
          emoji="🎉"
          title="Хичээл дууслаа!"
          xp={result.xpEarned}
          subtitle={
            result.nextNode?.kind === 'quiz'
              ? 'Бүлгийн шалгалт нээгдлээ!'
              : result.nextNode
                ? 'Дараагийн хичээл нээгдлээ.'
                : 'Гайхалтай!'
          }
          onContinue={close}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingTop: 0 },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg },
  texts: { gap: Spacing.sm },
  watchCard: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  notReady: { aspectRatio: 16 / 9, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg },
  watchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  footer: { padding: Spacing.lg, borderTopWidth: 2 },
});

import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, SlideInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import type { CheckAnswerResult, Quiz, QuizAnswer, QuizSubmitResult } from '@/api/types';
import { OptionCard, type OptionState } from '@/components/quiz/option-card';
import { RewardOverlay } from '@/components/reward-overlay';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ErrorView, LoadingView, MessageView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { showToast } from '@/components/ui/toast';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLearning } from '@/store/learning';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function haptic(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS !== 'web') Haptics.notificationAsync(type).catch(() => {});
}

type Load = { status: 'loading' } | { status: 'error'; error: ApiError } | { status: 'ready'; quiz: Quiz };

export default function QuizScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recordProgress = useLearning((s) => s.recordProgress);

  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState<CheckAnswerResult | null>(null);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [showReward, setShowReward] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    api.quiz(id).then(
      (quiz) => active && setLoad({ status: 'ready', quiz }),
      (e: ApiError) => active && setLoad({ status: 'error', error: e }),
    );
    return () => {
      active = false;
    };
  }, [id, attempt]);

  function retry() {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }

  function restart() {
    setIndex(0);
    setSelected(null);
    setChecked(null);
    setAnswers([]);
    setResult(null);
    setShowReward(false);
  }

  if (load.status !== 'ready') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <ScreenHeader onClose={close} />
        {load.status === 'loading' ? (
          <LoadingView label="Шалгалт ачаалж байна…" />
        ) : load.error.code === 'LOCKED' ? (
          <MessageView icon="lock-closed" title="Шалгалт түгжээтэй" message={load.error.message} actionLabel="Буцах" onAction={close} />
        ) : (
          <ErrorView message={load.error.message} onRetry={retry} />
        )}
      </SafeAreaView>
    );
  }

  const { quiz } = load;
  const question = quiz.questions[index]!;
  const total = quiz.questions.length;
  const isLast = index === total - 1;

  async function check() {
    if (selected == null) return;
    setBusy(true);
    try {
      const res = await api.checkAnswer(quiz.id, question.id, selected);
      setChecked(res);
      setAnswers((prev) => [...prev, { questionId: question.id, answerIndex: selected }]);
      haptic(res.correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!isLast) {
      setIndex(index + 1);
      setSelected(null);
      setChecked(null);
      return;
    }
    setBusy(true);
    try {
      const res = await api.submitQuiz(quiz.id, answers);
      if (res.passed) recordProgress(quiz.id, res.nextNode, res.summary);
      setResult(res);
      setShowReward(res.passed);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function optionState(i: number): OptionState {
    if (!checked) return selected === i ? 'selected' : 'idle';
    if (i === checked.correctIndex) return 'correct';
    if (i === selected) return 'wrong';
    return 'dimmed';
  }

  // ---- result screen -------------------------------------------------------
  if (result) {
    if (showReward) {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
          <RewardOverlay
            emoji="🏆"
            title="Шалгалтад тэнцлээ!"
            xp={result.xpEarned}
            subtitle={result.unlockedUnitId ? 'Дараагийн бүлэг нээгдлээ 🔓' : result.alreadyPassed ? 'Давтан өгсөн тул XP нэмэгдээгүй.' : undefined}
            actionLabel="Дүнгээ харах"
            onContinue={() => setShowReward(false)}
          />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <ScreenHeader onClose={close} />
        <View style={[styles.column, styles.resultBody]}>
          <Animated.Text entering={FadeIn} style={styles.resultEmoji}>
            {result.passed ? '🏆' : '💪'}
          </Animated.Text>
          <Text variant="title" center>
            {result.passed ? 'Тэнцлээ!' : 'Бага зэрэг дутлаа'}
          </Text>
          <View style={[styles.scoreCard, { backgroundColor: t.surface }]}>
            <Text style={[styles.score, { color: result.passed ? t.green : t.red }]}>
              {result.correctCount} / {result.totalCount}
            </Text>
            <Text color="textSecondary">Зөв хариулт · {result.scorePercent}%</Text>
            <View style={styles.scoreRow}>
              <View style={[styles.pill, { backgroundColor: t.gold }]}>
                <Text variant="bodyBold" style={{ color: '#fff' }}>
                  ⚡ +{result.xpEarned} XP
                </Text>
              </View>
            </View>
          </View>
          <Text color="textSecondary" center>
            {result.passed
              ? result.unlockedUnitId
                ? 'Дараагийн бүлэг нээгдлээ. Үргэлжлүүлээрэй!'
                : 'Сайн байна! Үргэлжлүүлээрэй.'
              : `Тэнцэхийн тулд дор хаяж ${result.passPercent}% зөв хариулах хэрэгтэй. Хичээлээ давтаад дахин оролдоорой.`}
          </Text>
        </View>
        <View style={[styles.footer, { borderTopColor: t.border }]}>
          <View style={[styles.column, { gap: Spacing.md }]}>
            {result.passed ? (
              <>
                <Button title="Үргэлжлүүлэх" variant="success" onPress={close} />
                <Button title="Дахин өгөх" variant="secondary" onPress={restart} />
              </>
            ) : (
              <>
                <Button title="Дахин өгөх" onPress={restart} />
                <Button title="Буцах" variant="secondary" onPress={close} />
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ---- question screen -----------------------------------------------------
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScreenHeader onClose={close}>
        <View style={styles.progressRow}>
          <ProgressBar percent={((index + (checked ? 1 : 0)) / total) * 100} accessibilityLabel="Шалгалтын ахиц" style={{ flex: 1 }} />
        </View>
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View key={question.id} entering={FadeInRight.duration(250)} style={[styles.column, { gap: Spacing.lg }]}>
          <Text variant="label" color="purple">
            Асуулт {index + 1} / {total}
          </Text>
          <Text variant="title">{question.text}</Text>
          <View style={styles.options} accessibilityRole="radiogroup">
            {question.options.map((opt, i) => (
              <OptionCard
                key={i}
                index={i}
                text={opt}
                state={optionState(i)}
                disabled={!!checked || busy}
                onPress={() => setSelected(i)}
              />
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {checked ? (
        <Animated.View
          entering={SlideInDown.duration(250)}
          style={[styles.feedback, { backgroundColor: checked.correct ? t.successSoft : t.dangerSoft }]}
          accessibilityLiveRegion="assertive">
          <View style={styles.column}>
            <Text variant="heading" style={{ color: checked.correct ? t.greenDark : t.redDark }}>
              {checked.correct ? 'Зөв байна! 🎉' : 'Буруу байна'}
            </Text>
            {!checked.correct && (
              <Text variant="bodyBold" style={{ color: t.redDark }}>
                Зөв хариулт: {question.options[checked.correctIndex]}
              </Text>
            )}
            <Button
              title={isLast ? 'Дүн харах' : 'Үргэлжлүүлэх'}
              variant={checked.correct ? 'success' : 'danger'}
              loading={busy}
              onPress={next}
              style={{ marginTop: Spacing.md }}
            />
          </View>
        </Animated.View>
      ) : (
        <View style={[styles.footer, { borderTopColor: t.border }]}>
          <View style={styles.column}>
            <Button title="Шалгах" disabled={selected == null} loading={busy} onPress={check} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  scroll: { padding: Spacing.lg },
  options: { gap: Spacing.md },
  footer: { padding: Spacing.lg, borderTopWidth: 2 },
  feedback: { padding: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  resultBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xl },
  resultEmoji: { fontSize: 88, lineHeight: 104 },
  scoreCard: { alignSelf: 'stretch', alignItems: 'center', borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.sm },
  score: { fontFamily: Fonts.black, fontSize: 48, lineHeight: 56 },
  scoreRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  pill: { paddingHorizontal: Spacing.lg, paddingVertical: 6, borderRadius: Radius.full },
});

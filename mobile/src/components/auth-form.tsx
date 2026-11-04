import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInputInstance } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth';

const DEMO = { email: 'demo@octolearn.mn', password: 'demo1234' };

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const t = useTheme();
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);
  const isLogin = mode === 'login';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'form' | 'demo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  function validate(): string | null {
    if (!isLogin && !name.trim()) return 'Нэрээ оруулна уу.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Имэйл хаягаа зөв оруулна уу.';
    if (password.length < (isLogin ? 1 : 6)) return isLogin ? 'Нууц үгээ оруулна уу.' : 'Нууц үг дор хаяж 6 тэмдэгт байна.';
    return null;
  }

  async function submit() {
    const invalid = validate();
    if (invalid) return setError(invalid);
    setError(null);
    setBusy('form');
    try {
      if (isLogin) await login(email, password);
      else await register(name, email, password);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function tryDemo() {
    setError(null);
    setBusy('demo');
    try {
      await login(DEMO.email, DEMO.password);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
              <View style={[styles.logo, { backgroundColor: t.primarySoft }]}>
                <Text style={styles.logoEmoji}>🐙</Text>
              </View>
              <Text variant="display" style={{ color: t.purple }}>
                OctoLearn
              </Text>
              <Text color="textSecondary" center>
                {isLogin ? 'Өдөр бүр 10 минут — англи хэлээ ахиулъя!' : 'Бүртгүүлээд сурч эхлээрэй'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.form}>
              {!isLogin && (
                <TextField
                  label="Нэр"
                  value={name}
                  onChangeText={setName}
                  placeholder="Болд"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              )}
              <TextField
                ref={emailRef}
                label="Имэйл"
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <TextField
                ref={passwordRef}
                label="Нууц үг"
                value={password}
                onChangeText={setPassword}
                placeholder={isLogin ? '••••••' : 'Дор хаяж 6 тэмдэгт'}
                secureTextEntry
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                textContentType={isLogin ? 'password' : 'newPassword'}
                returnKeyType="go"
                onSubmitEditing={submit}
              />

              {error ? (
                <Text variant="bodyBold" style={{ color: t.red }} accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}

              <Button
                title={isLogin ? 'Нэвтрэх' : 'Бүртгүүлэх'}
                onPress={submit}
                loading={busy === 'form'}
                disabled={busy !== null}
              />
              {isLogin && (
                <Button title="Demo-гоор турших" variant="secondary" onPress={tryDemo} loading={busy === 'demo'} disabled={busy !== null} />
              )}
            </Animated.View>

            <View style={styles.switch}>
              <Text color="textSecondary">{isLogin ? 'Бүртгэлгүй юу?' : 'Бүртгэлтэй юу?'}</Text>
              <Button
                title={isLogin ? 'Бүртгүүлэх' : 'Нэвтрэх'}
                variant="ghost"
                style={styles.switchBtn}
                onPress={() => router.replace(isLogin ? '/register' : '/login')}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  content: { width: '100%', maxWidth: MaxContentWidth - 120, alignSelf: 'center', gap: Spacing.xl },
  hero: { alignItems: 'center', gap: Spacing.sm },
  logo: { width: 96, height: 96, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  logoEmoji: { fontSize: 56, lineHeight: 68 },
  form: { gap: Spacing.lg },
  switch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  switchBtn: { alignSelf: 'auto' },
});

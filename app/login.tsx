import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, MaxContentWidth, NoWebFocusRing, Radius, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MIN_PASSWORD_LENGTH = 6;

export default function LoginScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const styles = themedStyles[scheme];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;

  function handleLogin() {
    if (!email || !password) {
      setError('Preencha todos os campos!');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setError('');
    Alert.alert('Sucesso', 'Login realizado com sucesso!');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}>
      <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.highlightPanel}>
            <Text style={styles.highlightEyebrow}>Acompanhamento familiar</Text>
            <Text style={styles.highlightTitle}>Bem-vindo de volta</Text>
            <Text style={styles.highlightText}>
              Entre com sua conta para acompanhar o tempo de uso dos dispositivos.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Login</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Digite seu email"
                placeholderTextColor={c.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                style={[styles.input, focused === 'email' && styles.inputFocused]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Digite sua senha"
                placeholderTextColor={c.textMuted}
                secureTextEntry
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                style={[
                  styles.input,
                  focused === 'password' && styles.inputFocused,
                  password.length > 0 && (passwordValid ? styles.inputValid : styles.inputInvalid),
                ]}
              />
              {password.length > 0 && (
                <Text style={passwordValid ? styles.hintValid : styles.hintInvalid}>
                  {passwordValid
                    ? 'Senha valida'
                    : `Minimo de ${MIN_PASSWORD_LENGTH} caracteres`}
                </Text>
              )}
            </View>

            <Pressable
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.loginBtn,
                pressed && styles.loginBtnPressed,
              ]}>
              <Text style={styles.loginBtnText}>Entrar</Text>
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    center: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 40,
    },
    container: {
      width: '100%',
      maxWidth: MaxContentWidth,
      gap: 14,
    },
    highlightPanel: {
      backgroundColor: c.accent,
      borderRadius: Radius.card,
      padding: 20,
      gap: 6,
    },
    highlightEyebrow: {
      color: c.onAccent,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      opacity: 0.85,
    },
    highlightTitle: {
      color: c.onAccent,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    highlightText: {
      color: c.onAccent,
      fontSize: 14,
      lineHeight: 20,
    },
    card: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.card,
      padding: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginBottom: 20,
      color: c.text,
    },
    inputGroup: {
      marginBottom: 15,
    },
    label: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
      color: c.textMuted,
    },
    input: {
      width: '100%',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: Radius.control,
      borderWidth: 1,
      borderColor: c.borderStrong,
      ...NoWebFocusRing,
      fontSize: 14,
      color: c.text,
      backgroundColor: c.background,
    },
    inputFocused: {
      borderColor: c.accent,
    },
    inputValid: {
      borderColor: c.success,
    },
    inputInvalid: {
      borderColor: c.danger,
    },
    hintValid: {
      color: c.success,
      fontSize: 12,
      marginTop: 4,
    },
    hintInvalid: {
      color: c.danger,
      fontSize: 12,
      marginTop: 4,
    },
    loginBtn: {
      width: '100%',
      paddingVertical: 12,
      borderRadius: Radius.control,
      backgroundColor: c.accent,
      alignItems: 'center',
    },
    loginBtnPressed: {
      backgroundColor: c.accentPressed,
    },
    loginBtnText: {
      color: c.onAccent,
      fontSize: 16,
      fontWeight: '700',
    },
    error: {
      color: c.danger,
      fontSize: 13,
      textAlign: 'center',
      marginTop: 10,
    },
  });
}

const themedStyles = {
  light: createStyles(Colors.light),
  dark: createStyles(Colors.dark),
};

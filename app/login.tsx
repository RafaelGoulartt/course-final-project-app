import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getApiBaseUrl, setApiBaseUrl } from '../constants/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiBaseUrl, setApiBaseUrlInput] = useState(getApiBaseUrl());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError('Preencha todos os campos!');
      return;
    }

    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const normalizedApiBaseUrl = setApiBaseUrl(apiBaseUrl);
      if (!normalizedApiBaseUrl) {
        setError('Informe a URL da API.');
        return;
      }

      const response = await fetch(`${normalizedApiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Não foi possível fazer login.');
      }

      Alert.alert('Sucesso', data.message || 'Login realizado com sucesso!', [
        { text: 'Continuar', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Erro ao conectar com a API.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={['#4facfe', '#00f2fe']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.center}>
          <View style={styles.card}>
            <Text style={styles.title}>Login</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>API base</Text>
              <TextInput
                value={apiBaseUrl}
                onChangeText={setApiBaseUrlInput}
                placeholder="http://10.0.2.2:3001/api"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Digite seu email"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Digite sua senha"
                placeholderTextColor="#999"
                secureTextEntry
                style={styles.input}
              />
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.loginBtn,
                (pressed || loading) && styles.loginBtnPressed,
              ]}>
              <Text style={styles.loginBtnText}>
                {loading ? 'Entrando...' : 'Entrar'}
              </Text>
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
    color: '#222',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    marginBottom: 5,
    color: '#333',
  },
  input: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    fontSize: 14,
    color: '#222',
    backgroundColor: '#fff',
  },
  loginBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4facfe',
    alignItems: 'center',
  },
  loginBtnPressed: {
    backgroundColor: '#3a8dde',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: 'red',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },
});

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import axios from 'axios';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, SafeAreaView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------
// ⚠️ IMPORTANT: Replace with your actual Local IP (e.g., 192.168.1.5)
// Do NOT use 'localhost' for physical devices.
// ONLY for Android Emulator
// In app/(tabs)/index.tsx
const API_URL = 'http://172.29.118.64:9000';
const PUBLISHABLE_API_KEY = 'pk_e3daf218eb487c40b1dc5217e7cb56ec05b6b1f9a8733e599190a7fe7efa3132';

export default function HomeScreen() {
  // UI State
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // ---------------------------------------------------------
  // API HANDLERS
  // ---------------------------------------------------------
  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in email and password');
      return;
    }

    if (!isLogin && (!firstName || !lastName)) {
      Alert.alert('Error', 'Please fill in name fields');
      return;
    }

    setLoading(true);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-publishable-api-key': PUBLISHABLE_API_KEY,
      };

      if (isLogin) {
        // --- LOGIN ---
        console.log(`Attempting login to: ${API_URL}/auth/customer/emailpass`);
        const response = await axios.post(
          `${API_URL}/auth/customer/emailpass`, 
          { email, password },
          { headers }
        );

        console.log('Login Success');
        setAuthToken(response.data.token);
        Alert.alert('Success', 'Welcome back!');
      } else {
        // --- REGISTER ---
        console.log(`Attempting register to: ${API_URL}/auth/customer/emailpass/register`);
        const response = await axios.post(
          `${API_URL}/auth/customer/emailpass/register`,
          {
            email,
            password,
            first_name: firstName,
            last_name: lastName,
          },
          { headers }
        );

        console.log('Register Success');
        Alert.alert('Success', 'Account created! Logging you in...');
        
        // Auto-login after register (optional, or just switch to login view)
        setIsLogin(true); 
      }
    } catch (error: any) {
      console.log('Error details:', error);
      const msg = error.response?.data?.message || error.message || 'Connection failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
  };

  // ---------------------------------------------------------
  // RENDER: MAIN SCREEN (Authenticated)
  // ---------------------------------------------------------
  if (authToken) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.contentContainer}>
          <Image
            source={require('@/assets/images/partial-react-logo.png')}
            style={styles.logoSmall}
          />
          <ThemedText type="title">Welcome Home!</ThemedText>
          <ThemedText style={{ marginTop: 10, textAlign: 'center' }}>
            You are securely logged in to your Medusa Store.
          </ThemedText>

          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">Session Active</ThemedText>
            <ThemedText style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
              Token: {authToken.substring(0, 15)}...
            </ThemedText>
          </ThemedView>

          <TouchableOpacity style={styles.buttonOutline} onPress={handleLogout}>
            <ThemedText style={styles.buttonOutlineText}>Log Out</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------
  // RENDER: LOGIN / SIGNUP SCREEN
  // ---------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText type="title" style={{ marginBottom: 20 }}>
          {isLogin ? 'Medusa Login' : 'Create Account'}
        </ThemedText>

        {/* Register Fields */}
        {!isLogin && (
          <>
            <TextInput
              style={styles.input}
              placeholder="First Name"
              value={firstName}
              onChangeText={setFirstName}
              placeholderTextColor="#888"
            />
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              value={lastName}
              onChangeText={setLastName}
              placeholderTextColor="#888"
            />
          </>
        )}

        {/* Common Fields */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#888"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#888"
        />

        {/* Action Button */}
        <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>
              {isLogin ? 'Log In' : 'Sign Up'}
            </ThemedText>
          )}
        </TouchableOpacity>

        {/* Toggle View */}
        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchContainer}>
          <ThemedText style={styles.switchText}>
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------
// STYLES
// ---------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff', 
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  contentContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoSmall: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#f9f9f9',
    padding: 20,
    borderRadius: 10,
    width: '100%',
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  input: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    width: '100%',
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonOutline: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 2,
    borderColor: '#000',
  },
  buttonOutlineText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchContainer: {
    marginTop: 20,
    padding: 10,
  },
  switchText: {
    color: '#0a7ea4',
    fontSize: 14,
  },
});
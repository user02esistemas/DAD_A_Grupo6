import React, { useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../components/Button';

export default function AdminScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);
  
  // Asumimos que el backend de desarrollo corre local en la IP conocida
  const baseUrl = 'http://192.168.100.8:8002';
  
  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button title="Cerrar Sesión Admin" onPress={handleLogout} variant="danger" style={{ padding: 8, width: '100%' }} />
      </View>
      <View style={{ flex: 1 }}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0d6efd" />
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ uri: `${baseUrl}/` }}
          style={{ flex: 1 }}
          onLoadEnd={() => setLoading(false)}
          sharedCookiesEnabled={true} // Intenta usar cookies de la sesión
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 1,
  }
});
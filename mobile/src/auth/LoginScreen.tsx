import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { DEFAULT_API_URL } from '../api/axiosConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '../components/Button';

export default function LoginScreen({ navigation }: any) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Cargar URL configurada
    const loadApiUrl = async () => {
      const savedUrl = await AsyncStorage.getItem('custom_api_url');
      if (savedUrl) {
        setApiUrl(savedUrl);
      }
    };
    loadApiUrl();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Por favor ingresa usuario y contraseña');
      return;
    }
    setLoading(true);
    try {
      // Guardar la URL configurada antes de hacer login
      await AsyncStorage.setItem('custom_api_url', apiUrl);
      apiClient.defaults.baseURL = apiUrl;

      const response = await apiClient.post('/auth/login/', { username, password });
      if (response.data.ok) {
        const { access, refresh, ...userData } = response.data.data;
        
        await AsyncStorage.setItem('access_token', access);
        await AsyncStorage.setItem('refresh_token', refresh);
        await AsyncStorage.setItem('user_data', JSON.stringify(userData));

        // Redirigir según el rol
        if (userData.rol === 'MOZO') {
          navigation.replace('MozoScreen');
        } else if (userData.rol === 'COCINERO') {
          navigation.replace('KdsScreen');
        } else if (userData.rol === 'ADMIN') {
          navigation.replace('AdminScreen');
        } else {
          Alert.alert('Rol no soportado en app móvil', `El rol ${userData.rol} debe acceder desde el panel web.`);
        }
      } else {
        Alert.alert('Error', response.data.message || 'Error de inicio de sesión');
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert(
        'Error de conexión',
        `No se pudo conectar al servidor.\n\nVerifica que el servidor esté activo en:\n${apiUrl}\n\nY que tu celular esté en la misma red Wi-Fi.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await AsyncStorage.setItem('custom_api_url', apiUrl);
      apiClient.defaults.baseURL = apiUrl;
      Alert.alert('Éxito', 'Dirección del servidor actualizada correctamente.');
      setShowSettings(false);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la configuración.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            {/* Columna Izquierda: Branding */}
            <LinearGradient
              colors={['#1F2333', '#131520']}
              style={styles.brandingColumn}
            >
              <View style={styles.logoContainer}>
                <Text style={[styles.logoIcon, { fontSize: 24, fontWeight: '900', color: '#0C0E14' }]}>OS</Text>
              </View>
              <Text style={styles.title}>RestaurantOS</Text>
              <Text style={styles.subtitle}>Gestión Móvil de Comandas y Cocina</Text>
              <View style={styles.tag}>
                <Text style={styles.tagText}>Modo Tablet</Text>
              </View>
            </LinearGradient>

            {/* Columna Derecha: Formulario */}
            <View style={styles.formColumn}>
              {showSettings ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Configuración de Red</Text>
                  <Text style={styles.label}>Dirección del Servidor API:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="http://192.168.1.100:8002/api/v1"
                    placeholderTextColor="#A5A5B1"
                    value={apiUrl}
                    onChangeText={setApiUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.helperText}>
                    Asegúrate de incluir "http://" o "https://" y el puerto correspondiente (ej. 8002).
                  </Text>
                  <View style={styles.buttonRow}>
                    <Button 
                      title="Cancelar"
                      onPress={() => setShowSettings(false)}
                      variant="secondary"
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Button 
                      title="Guardar"
                      onPress={handleSaveSettings}
                      variant="primary"
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Iniciar Sesión</Text>
                  
                  <TextInput
                    style={styles.input}
                    placeholder="Usuario"
                    placeholderTextColor="#A5A5B1"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  
                  <TextInput
                    style={styles.input}
                    placeholder="Contraseña"
                    placeholderTextColor="#A5A5B1"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                  
                  <Button 
                    title="Ingresar al Sistema"
                    onPress={handleLogin}
                    loading={loading}
                    variant="primary"
                    style={{ marginTop: 10 }}
                  />

                  <TouchableOpacity 
                    style={styles.settingsLink}
                    onPress={() => setShowSettings(true)}
                  >
                    <Text style={styles.settingsLinkText}>Configurar Dirección IP / Servidor</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0E14',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  brandingColumn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#C6BFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#C6BFFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoIcon: {
    fontSize: 36,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    color: '#FFF',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#A5A5B1',
    fontWeight: '500',
    marginBottom: 24,
    lineHeight: 22,
  },
  tag: {
    backgroundColor: 'rgba(198, 191, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(198, 191, 255, 0.2)',
  },
  tagText: {
    color: '#C6BFFF',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  formColumn: {
    flex: 1.2,
    justifyContent: 'center',
    padding: 48,
    backgroundColor: '#0C0E14',
  },
  card: {
    backgroundColor: '#1A1D27',
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  label: {
    color: '#A5A5B1',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  helperText: {
    color: '#A5A5B1',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  settingsLink: {
    marginTop: 20,
    alignSelf: 'center',
    padding: 8,
  },
  settingsLinkText: {
    color: '#C6BFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Modal, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/axiosConfig';
import Loader from '../components/Loader';
import Button from '../components/Button';
import Card from '../components/Card';

export default function CajeroScreen({ navigation }: any) {
  const [mesasPorCobrar, setMesasPorCobrar] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [turnoAbierto, setTurnoAbierto] = useState(false);
  
  const [tab, setTab] = useState<'COBROS' | 'HISTORIAL'>('COBROS');

  // Pago Modal
  const [pagoModalVisible, setPagoModalVisible] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<any>(null);
  const [montoEfectivo, setMontoEfectivo] = useState('');
  const [montoTarjeta, setMontoTarjeta] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const turnoRes = await apiClient.get('/caja/turno-activo/').catch(()=>null);
      const isActivo = turnoRes?.data?.data?.activo !== undefined ? turnoRes.data.data.activo : turnoRes?.data?.activo;
      if (isActivo) {
        setTurnoAbierto(true);
      } else {
        setTurnoAbierto(false);
      }

      if (tab === 'COBROS') {
        const res = await apiClient.get('/mesas/estado-actual/');
        const mesasData = res.data?.data?.mesas || res.data?.mesas;
        if (mesasData) {
          const porCobrar = mesasData.filter((m: any) => m.estado === 'POR_COBRAR');
          setMesasPorCobrar(porCobrar);
        }
      } else {
        const resH = await apiClient.get('/caja/historial/');
        const historialData = resH.data?.data?.pagos || resH.data?.pagos;
        if (historialData) {
          setHistorial(historialData);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tab]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchData();
    });
    return unsubscribe;
  }, [navigation]);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  const abrirTurno = async () => {
    try {
      const res = await apiClient.post('/caja/apertura/', { monto_inicial: 0 });
      if (res.data.ok) {
        Alert.alert('Turno Abierto', 'Se abrió la caja con S/ 0.');
        fetchData();
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Error abriendo turno');
    }
  };

  const cerrarTurno = async () => {
    Alert.alert('Cerrar Turno', '¿Estás seguro de cerrar la caja?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar', onPress: async () => {
          try {
            const res = await apiClient.post('/caja/cierre/', { efectivo_final: 0 }); // arqueo ciego simple
            if (res.data.ok) {
              Alert.alert('Turno Cerrado', 'La caja se cerró exitosamente.');
              fetchData();
            }
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Error cerrando turno');
          }
      }, style: 'destructive' }
    ]);
  };

  const pagarComanda = async () => {
    if (!selectedMesa || !selectedMesa.comanda) return;
    
    const pagos = [];
    const me = parseFloat(montoEfectivo);
    const mt = parseFloat(montoTarjeta);
    
    if (me > 0) pagos.push({ metodo_pago_id: 1, monto: me, referencia: '' }); // 1 = Efectivo
    if (mt > 0) pagos.push({ metodo_pago_id: 2, monto: mt, referencia: 'POS' }); // 2 = Tarjeta

    if (pagos.length === 0) {
      // Por defecto todo efectivo si no pone nada y total > 0
      pagos.push({ metodo_pago_id: 1, monto: parseFloat(selectedMesa.comanda.total) || 0, referencia: '' });
    }

    try {
      const res = await apiClient.post(`/caja/pagar/${selectedMesa.comanda.id}/`, { pagos });
      if (res.data.ok) {
        Alert.alert('Cobro Exitoso', 'Comanda pagada.');
        setPagoModalVisible(false);
        fetchData();
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Error procesando el pago');
    }
  };

  const registrarPerdida = async () => {
    if (!selectedMesa || !selectedMesa.comanda) return;
    Alert.alert('Registrar Pérdida', '¿Confirmas que el cliente se fue sin pagar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar Pérdida', onPress: async () => {
          try {
            const res = await apiClient.post(`/caja/registrar-perdida/${selectedMesa.comanda.id}/`, { observacion: 'El cliente se retiró sin pagar.' });
            if (res.data.ok) {
              Alert.alert('Pérdida Registrada', 'La comanda ha sido marcada como pérdida.');
              setPagoModalVisible(false);
              fetchData();
            }
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Error procesando la pérdida');
          }
      }, style: 'destructive' }
    ]);
  };

  const openPagoModal = (mesa: any) => {
    setSelectedMesa(mesa);
    setMontoEfectivo('');
    setMontoTarjeta('');
    setPagoModalVisible(true);
  };

  const renderMesa = ({ item }: { item: any }) => (
    <Card style={styles.mesaCard}>
      <Text style={styles.mesaTitle}>Mesa {item.numero}</Text>
      <Text style={styles.mozoName}>Total a cobrar: S/ {item.comanda?.total || '0.00'}</Text>
      <Button title="Realizar Cobro" onPress={() => openPagoModal(item)} variant="success" style={{ marginTop: 10 }} />
    </Card>
  );

  const renderHistorial = ({ item }: { item: any }) => (
    <Card style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{item.mesa} - {item.cliente}</Text>
      <Text style={{ fontSize: 14, color: '#666', marginVertical: 4 }}>Fecha: {item.fecha_pago}</Text>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: item.estado === 'PERDIDA' ? '#dc3545' : '#198754' }}>
        {item.estado === 'PERDIDA' ? 'PÉRDIDA' : `PAGADO: S/ ${item.monto_total}`}
      </Text>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Caja</Text>
        <Button title="Salir" onPress={handleLogout} variant="danger" style={{ padding: 8 }} />
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, tab === 'COBROS' && styles.tabActive]} onPress={() => setTab('COBROS')}>
          <Text style={[styles.tabText, tab === 'COBROS' && styles.tabTextActive]}>Por Cobrar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'HISTORIAL' && styles.tabActive]} onPress={() => setTab('HISTORIAL')}>
          <Text style={[styles.tabText, tab === 'HISTORIAL' && styles.tabTextActive]}>Historial</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Loader />
      ) : (
        <View style={{ flex: 1 }}>
          {!turnoAbierto ? (
            <View style={styles.turnoContainer}>
              <Text style={{ fontSize: 18, marginBottom: 16 }}>El turno de caja está cerrado.</Text>
              <Button title="Abrir Turno" onPress={abrirTurno} variant="primary" />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {tab === 'COBROS' ? (
                <>
                  <FlatList
                    data={mesasPorCobrar}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderMesa}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No hay mesas pendientes de cobro.</Text>}
                  />
                  <View style={{ padding: 16, borderTopWidth: 1, borderColor: '#dee2e6', backgroundColor: '#fff' }}>
                    <Button title="Cerrar Turno de Caja" onPress={cerrarTurno} variant="danger" />
                  </View>
                </>
              ) : (
                <FlatList
                  data={historial}
                  keyExtractor={item => item.comanda_id.toString()}
                  renderItem={renderHistorial}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No hay cobros registrados hoy.</Text>}
                />
              )}
            </View>
          )}
        </View>
      )}

      {/* Modal de Pago Compuesto */}
      <Modal visible={pagoModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cobrar Mesa {selectedMesa?.numero}</Text>
            <Text style={{ fontSize: 16, marginBottom: 16, fontWeight: 'bold' }}>
              Total a Pagar: S/ {selectedMesa?.comanda?.total || '0.00'}
            </Text>

            <Text>Monto en Efectivo:</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="numeric"
              value={montoEfectivo}
              onChangeText={setMontoEfectivo}
            />

            <Text>Monto en Tarjeta / Yape:</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="numeric"
              value={montoTarjeta}
              onChangeText={setMontoTarjeta}
            />
            
            <View style={{ marginTop: 10 }}>
              <Button title="Confirmar Pago" onPress={pagarComanda} variant="success" />
              <Button title="Registrar Pérdida (No pagó)" onPress={registrarPerdida} variant="danger" />
              <Button title="Cancelar" onPress={() => setPagoModalVisible(false)} variant="secondary" />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  title: { fontSize: 22, fontWeight: 'bold' },
  
  tabsContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#dee2e6' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#0d6efd' },
  tabText: { fontSize: 16, fontWeight: '600', color: '#6c757d' },
  tabTextActive: { color: '#0d6efd' },

  turnoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  list: { padding: 16 },
  mesaCard: { borderLeftWidth: 5, borderLeftColor: '#0dcaf0' },
  mesaTitle: { fontSize: 18, fontWeight: 'bold' },
  mozoName: { fontSize: 16, color: '#198754', marginTop: 4, fontWeight: 'bold' },
  
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginVertical: 8 }
});
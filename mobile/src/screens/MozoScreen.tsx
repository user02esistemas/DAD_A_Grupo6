import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/axiosConfig';
import Loader from '../components/Loader';
import Button from '../components/Button';
import CatalogModal from '../components/CatalogModal';
import UnirMesasModal from '../components/UnirMesasModal';

export default function MozoScreen({ navigation }: any) {
  const [mesas, setMesas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPiso, setSelectedPiso] = useState<string | null>(null);
  
  // Selected Table details state (replaces MesaDetailScreen)
  const [selectedMesa, setSelectedMesa] = useState<any | null>(null);
  const [comandaId, setComandaId] = useState<number | null>(null);
  const [lineas, setLineas] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Catalog / Join Modals state
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [unirModalVisible, setUnirModalVisible] = useState(false);

  const ws = useRef<WebSocket | null>(null);

  const fetchMesas = async () => {
    try {
      const response = await apiClient.get('/mesas/estado-actual/');
      if (response.data && response.data.mesas) {
        const listMesas = response.data.mesas;
        setMesas(listMesas);
        
        // Mantener seleccionada la mesa actual y actualizar sus datos
        if (selectedMesa) {
          const updatedMesa = listMesas.find((m: any) => m.id === selectedMesa.id);
          if (updatedMesa) {
            setSelectedMesa(updatedMesa);
          }
        }
        
        if (!selectedPiso && listMesas.length > 0) {
          setSelectedPiso(listMesas[0].piso_label);
        }
      }
    } catch (error) {
      console.error('Error fetching mesas:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchComandaActiva = async (targetMesaId: number) => {
    setLoadingDetail(true);
    try {
      const res = await apiClient.get(`/comandas/mesa/${targetMesaId}/activa/`);
      const payload = res.data.data ? res.data.data : res.data;
      if (res.data.ok) {
        setComandaId(payload.comanda_id);
        setLineas(payload.lineas || []);
      } else {
        setComandaId(null);
        setLineas([]);
      }
    } catch (e: any) {
      setComandaId(null);
      setLineas([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const connectWebSocket = async () => {
    const token = await AsyncStorage.getItem('access_token');
    if (!token) return;

    const baseURL = apiClient.defaults.baseURL || 'http://192.168.100.13:8002/api/v1';
    const wsProtocol = baseURL.startsWith('https') ? 'wss:' : 'ws:';
    const host = baseURL.split('//')[1].split('/')[0];
    const wsUrl = `${wsProtocol}//${host}/ws/notificaciones/?token=${token}`;
    
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'comida_lista') {
        Alert.alert(
          '¡Plato Listo en Cocina!', 
          `El plato "${data.plato}" para el cliente ${data.cliente} (Mesa ${data.mesa}) ya está listo para ser recogido.`
        );
        fetchMesas();
        if (selectedMesa && (selectedMesa.id === data.mesa_id || (selectedMesa.union && selectedMesa.union.mesa_ids?.includes(data.mesa_id)))) {
          fetchComandaActiva(selectedMesa.id);
        }
      } else if (data.type === 'cancelacion_parcial') {
        Alert.alert(
          'Cancelación en Cocina', 
          `Mesa ${data.mesa}: ${data.plato} ha sido cancelado parcialmente.\nMotivo: ${data.motivo}`
        );
        fetchMesas();
        if (selectedMesa && (selectedMesa.id === data.mesa_id || (selectedMesa.union && selectedMesa.union.mesa_ids?.includes(data.mesa_id)))) {
          fetchComandaActiva(selectedMesa.id);
        }
      }
    };
  };

  useEffect(() => {
    fetchMesas();
    connectWebSocket();

    const interval = setInterval(() => {
      fetchMesas();
    }, 5000);

    const unsubscribe = navigation.addListener('focus', () => {
      fetchMesas();
    });
    return () => {
      unsubscribe();
      clearInterval(interval);
      if (ws.current) ws.current.close();
    };
  }, [navigation]);

  useEffect(() => {
    if (selectedMesa) {
      fetchComandaActiva(selectedMesa.id);
    } else {
      setComandaId(null);
      setLineas([]);
    }
  }, [selectedMesa?.id]);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  // Acciones de la mesa
  const marcarLimpia = async () => {
    if (!selectedMesa) return;
    try {
      const res = await apiClient.post(`/mesas/${selectedMesa.id}/limpiada/`);
      if (res.data.ok) {
        Alert.alert('Éxito', 'La mesa ha sido limpiada y liberada.');
        fetchMesas();
        setSelectedMesa(null);
      }
    } catch (e: any) {
      const msg = e.response?.data?.errors?.[0]?.detail || e.response?.data?.message || e.response?.data?.error || 'Error al limpiar mesa';
      Alert.alert('Error', msg);
    }
  };

  const entregarPedido = async () => {
    if (!comandaId || !selectedMesa) return;
    try {
      const res = await apiClient.post(`/comandas/${comandaId}/entregar/`);
      if (res.data.ok) {
        Alert.alert('Éxito', res.data.message);
        fetchComandaActiva(selectedMesa.id);
        fetchMesas();
      }
    } catch (e: any) {
      const msg = e.response?.data?.errors?.[0]?.detail || e.response?.data?.message || e.response?.data?.error || 'Error entregando pedido';
      Alert.alert('Error', msg);
    }
  };

  const liberarMesa = async () => {
    if (!selectedMesa) return;
    try {
      const res = await apiClient.post(`/comandas/mesa/${selectedMesa.id}/liberar/`);
      if (res.data.ok) {
        Alert.alert('Enviado a Caja', 'La mesa ha sido enviada a caja para cobro.');
        fetchMesas();
        setSelectedMesa(null);
      }
    } catch (e: any) {
      const msg = e.response?.data?.errors?.[0]?.detail || e.response?.data?.message || e.response?.data?.error || 'Error liberando mesa';
      Alert.alert('Error', msg);
    }
  };

  const eliminarLinea = (lineaId: number) => {
    Alert.alert(
      'Eliminar Plato',
      '¿Estás seguro de eliminar este plato de la orden?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiClient.delete(`/comandas/linea/${lineaId}/editar/`);
              if (res.data.ok) {
                if (selectedMesa) {
                  fetchComandaActiva(selectedMesa.id);
                  fetchMesas();
                }
              }
            } catch (e: any) {
              const msg = e.response?.data?.errors?.[0]?.detail || e.response?.data?.message || e.response?.data?.error || 'Error al eliminar línea';
              Alert.alert('Error', msg);
            }
          } 
        }
      ]
    );
  };

  const onSendCart = async (cart: any[]) => {
    if (cart.length === 0 || !selectedMesa) return;
    try {
      if (!comandaId) {
        // Crear comanda
        const res = await apiClient.post('/comandas/crear/', {
          mesa_id: selectedMesa.id,
          items: cart.map(item => ({
            plato_id: item.plato_id,
            cantidad: item.cantidad,
            notas: item.notas,
            insumo_ids_excluidos: item.insumo_ids_excluidos || []
          }))
        });
        if (res.data.ok) {
          setCatalogVisible(false);
          fetchMesas();
          fetchComandaActiva(selectedMesa.id);
        }
      } else {
        // Agregar a comanda existente
        for (const item of cart) {
          await apiClient.post(`/comandas/${comandaId}/platos/`, { 
            plato_id: item.plato_id, 
            cantidad: item.cantidad, 
            notas: item.notas,
            insumo_ids_excluidos: item.insumo_ids_excluidos || []
          });
        }
        setCatalogVisible(false);
        fetchMesas();
        fetchComandaActiva(selectedMesa.id);
      }
    } catch (e: any) {
      const msg = e.response?.data?.errors?.[0]?.detail || e.response?.data?.message || e.response?.data?.error || 'Error enviando carrito';
      Alert.alert('Error', msg);
    }
  };

  // Unión de mesas
  const openUnirModal = () => {
    setUnirModalVisible(true);
  };

  const disolverUnion = async () => {
    if (!selectedMesa || !selectedMesa.union?.id) return;
    Alert.alert('Confirmar', '¿Deshacer la unión de estas mesas?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Disolver', style: 'destructive', onPress: async () => {
          try {
            const res = await apiClient.delete(`/mesas/union/${selectedMesa.union.id}/disolver/`);
            if (res.data.ok) {
              Alert.alert('Éxito', 'Unión disuelta.');
              fetchMesas();
              setSelectedMesa(null);
            }
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Error disolviendo unión');
          }
        }
      }
    ]);
  };

  const getMesaDisplayInfo = (item: any) => {
    if (!item) return { label: '', color: '#A5A5B1' };
    let label = item.estado_label || item.estado;
    let color = '#A5A5B1';

    if (item.estado === 'LIBRE') {
      label = 'Libre';
      color = '#4EDEA3';
    } else if (item.estado === 'LIMPIEZA') {
      label = 'En Limpieza';
      color = '#F97316';
    } else if (item.estado === 'POR_COBRAR' || item.estado === 'POR_PAGAR') {
      label = 'Por Pagar';
      color = '#60A5FA';
    } else if (item.estado === 'ENTREGADO') {
      label = 'Pedido Entregado';
      color = '#FBBF24';
    } else if (item.estado === 'OCUPADA') {
      const lineasItems = (selectedMesa && selectedMesa.id === item.id) 
        ? lineas 
        : (item.comanda?.lineas || []);
        
      const tieneListos = lineasItems.some((l: any) => l.estado === 'LISTO');
      const tienePrep = lineasItems.some((l: any) => l.estado === 'PENDIENTE' || l.estado === 'EN_PREP' || l.estado === 'EN PREP');

      if (tieneListos) {
        label = 'Listo';
        color = '#FBBF24';
      } else if (tienePrep) {
        label = 'En Preparación';
        color = '#F87171';
      } else {
        label = 'Ocupada';
        color = '#F87171';
      }
    }

    return { label, color };
  };

  const getLineaColor = (estadoLinea: string) => {
    if (estadoLinea === 'LISTO') return '#4EDEA3';
    if (estadoLinea === 'EN PREP' || estadoLinea === 'EN_PREP') return '#FBBF24';
    if (estadoLinea === 'ENTREGADO') return '#60A5FA';
    return '#A5A5B1';
  };

  // Filtrar mesas duplicadas para el plano general
  const mesasUnicas = mesas.filter(m => !m.union || m.union.es_principal);
  const pisos = Array.from(new Set(mesasUnicas.map(m => m.piso_label)));
  const mesasMostradas = mesasUnicas.filter(m => m.piso_label === selectedPiso);

  const renderMesa = ({ item }: { item: any }) => {
    const isGrupo = !!item.union;
    const numerosLabel = isGrupo ? item.union.mesa_numeros.join(' + ') : item.numero;
    const { label, color } = getMesaDisplayInfo(item);
    const isSelected = selectedMesa?.id === item.id;

    return (
      <TouchableOpacity 
        style={[
          styles.mesaCard, 
          { borderColor: isSelected ? '#C6BFFF' : 'rgba(255,255,255,0.1)', borderWidth: isSelected ? 2 : 1 }
        ]}
        onPress={() => setSelectedMesa(item)}
      >
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={styles.mesaTitle}>Mesa {numerosLabel}</Text>
        <Text style={[styles.mesaEstado, { color }]}>{label}</Text>
        <Text style={styles.mesaCap}>Cap: {item.capacidad}</Text>
        {item.comanda && (
          <View style={styles.comandaBadge}>
            <Text style={styles.mesaComanda}>S/ {item.comanda.total}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const hasListos = Array.isArray(lineas) && lineas.some(l => l.estado === 'LISTO');
  const hasEnCocina = Array.isArray(lineas) && lineas.some(l => l.estado === 'PENDIENTE' || l.estado === 'EN PREP' || l.estado === 'EN_PREP');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={[styles.logoIcon, { fontSize: 20, fontWeight: '900', color: '#C6BFFF', marginRight: 8 }]}>OS</Text>
          <Text style={styles.title}>Salón de Mesas</Text>
        </View>
        <Button title="Cerrar Sesión" onPress={handleLogout} variant="danger" style={{ padding: 8, paddingHorizontal: 16 }} />
      </View>
      
      {loading ? (
        <Loader color="#C6BFFF" />
      ) : (
        <View style={styles.mainPanel}>
          {/* Panel Izquierdo: Plano de Mesas */}
          <View style={styles.leftColumn}>
            <View style={styles.pisosContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {pisos.map(piso => (
                  <TouchableOpacity 
                    key={piso} 
                    style={[styles.pisoTab, selectedPiso === piso && styles.pisoTabActive]}
                    onPress={() => setSelectedPiso(piso)}
                  >
                    <Text style={[styles.pisoTabText, selectedPiso === piso && styles.pisoTabTextActive]}>{piso}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <FlatList
              data={mesasMostradas}
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMesas(); }} tintColor="#C6BFFF" colors={['#C6BFFF']} />
              }
              renderItem={renderMesa}
            />
          </View>

          {/* Panel Derecho: Detalles de la Mesa */}
          <View style={styles.rightColumn}>
            {selectedMesa ? (
              <View style={styles.detailContainer}>
                {/* Cabecera del detalle */}
                {(() => {
                  const { label: dLabel, color: dColor } = getMesaDisplayInfo(selectedMesa);
                  return (
                    <View style={styles.detailHeader}>
                      <Text style={styles.detailTitle}>Mesa {selectedMesa.union ? selectedMesa.union.mesa_numeros.join(' + ') : selectedMesa.numero}</Text>
                      <View style={[styles.detailStateBadge, { backgroundColor: dColor }]}>
                        <Text style={[styles.detailStateText, { color: '#0C0E14' }]}>{dLabel}</Text>
                      </View>
                    </View>
                  );
                })()}
                
                <Text style={styles.detailSub}>Capacidad: {selectedMesa.capacidad} personas | Piso: {selectedMesa.piso_label}</Text>

                {/* Acciones principales de la mesa */}
                <View style={styles.detailActions}>
                  {selectedMesa.estado !== 'LIMPIEZA' && selectedMesa.estado !== 'POR_COBRAR' && selectedMesa.estado !== 'POR_PAGAR' && (
                    <Button title="Tomar Pedido" onPress={() => setCatalogVisible(true)} variant="primary" style={styles.actionBtn} />
                  )}
                  
                  {selectedMesa.estado === 'LIBRE' && !selectedMesa.union && (
                    <Button title="Unir Mesas" onPress={openUnirModal} variant="secondary" style={styles.actionBtn} />
                  )}

                  {!!selectedMesa.union && (
                    <Button title="Disolver Unión" onPress={disolverUnion} variant="danger" style={styles.actionBtn} />
                  )}

                  {selectedMesa.estado === 'LIMPIEZA' && (
                    <Button title="Mesa Limpia" onPress={marcarLimpia} variant="success" style={styles.actionBtn} />
                  )}
                </View>

                {/* Listado de comandas/pedidos */}
                {selectedMesa.estado !== 'LIBRE' && selectedMesa.estado !== 'LIMPIEZA' && (
                  <View style={{ flex: 1, marginTop: 4 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 6 }]}>Platos en la Orden:</Text>
                    {loadingDetail ? (
                      <Loader color="#C6BFFF" />
                    ) : (
                      <>
                        <FlatList
                          data={lineas}
                          keyExtractor={item => item.id.toString()}
                          style={{ flex: 1 }}
                          renderItem={({ item }) => (
                            <View style={styles.lineaRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.lineaName}>{item.cantidad}x {item.plato_nombre}</Text>
                                {!!item.observacion && <Text style={styles.lineaNotas}>Notas: {item.observacion}</Text>}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                  <View style={[styles.statusDotSmall, { backgroundColor: getLineaColor(item.estado) }]} />
                                  <Text style={[styles.lineaEstadoText, { color: getLineaColor(item.estado) }]}>{item.estado}</Text>
                                </View>
                              </View>
                              {item.estado === 'PENDIENTE' && (
                                <TouchableOpacity onPress={() => eliminarLinea(item.id)} style={styles.deleteItemBtn}>
                                  <Text style={styles.deleteItemText}>X</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                          contentContainerStyle={{ paddingBottom: 16 }}
                          ListEmptyComponent={<Text style={styles.emptyText}>No hay platos registrados en esta comanda.</Text>}
                        />

                        {/* Botones de flujo */}
                        <View style={styles.bottomFlowActions}>
                          {hasListos && (
                            <Button title="Entregar Platos Listos" onPress={entregarPedido} variant="success" style={styles.flowBtn} />
                          )}
                          
                          {selectedMesa.estado !== 'POR_COBRAR' && selectedMesa.estado !== 'POR_PAGAR' && (
                            <>
                              <Button 
                                title="Enviar a Caja / Pre-Cuenta" 
                                onPress={liberarMesa} 
                                variant="danger" 
                                style={styles.flowBtn}
                                disabled={hasEnCocina}
                              />
                              {hasEnCocina && (
                                <Text style={styles.warningText}>
                                  No puedes enviar a caja si hay platos pendientes en cocina.
                                </Text>
                              )}
                            </>
                          )}
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptyDetailContainer}>
                <Text style={{ fontSize: 36, fontWeight: '900', color: '#C6BFFF', marginBottom: 16 }}>OS</Text>
                <Text style={styles.emptyDetailText}>Selecciona una mesa del plano</Text>
                <Text style={styles.emptyDetailSub}>Podrás ver los pedidos, tomar órdenes, unir mesas o enviarlas a caja.</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Catalog modal */}
      <CatalogModal visible={catalogVisible} onClose={() => setCatalogVisible(false)} onSendCart={onSendCart} />

      {/* Modal Unir Mesas */}
      <UnirMesasModal 
        visible={unirModalVisible} 
        onClose={() => setUnirModalVisible(false)} 
        selectedMesa={selectedMesa} 
        onSuccess={() => { fetchMesas(); setSelectedMesa(null); }} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C0E14' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1A1D27',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logoIcon: { fontSize: 24, marginRight: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  
  mainPanel: { flex: 1, flexDirection: 'row' },
  
  leftColumn: { flex: 1.4, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)' },
  rightColumn: { flex: 1, backgroundColor: '#141620' },
  
  pisosContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  pisoTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pisoTabActive: { backgroundColor: '#C6BFFF', borderColor: '#C6BFFF' },
  pisoTabText: { color: '#A5A5B1', fontWeight: '600', fontSize: 15 },
  pisoTabTextActive: { color: '#0C0E14', fontWeight: '800' },
  
  list: { padding: 8, paddingBottom: 32 },
  mesaCard: {
    flex: 1,
    backgroundColor: '#1A1D27',
    margin: 8,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 16,
    right: 16,
  },
  mesaTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginTop: 4 },
  mesaEstado: { fontSize: 13, marginTop: 4, fontWeight: '700', letterSpacing: 0.5 },
  mesaCap: { fontSize: 12, color: '#A5A5B1', marginTop: 8 },
  comandaBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(198,191,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(198,191,255,0.2)'
  },
  mesaComanda: { fontSize: 13, color: '#C6BFFF', fontWeight: '700' },
  
  // Detalle derecho
  detailContainer: { flex: 1, padding: 12 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  detailTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  detailStateBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  detailStateText: { color: '#000', fontWeight: '800', fontSize: 11 },
  detailSub: { color: '#A5A5B1', fontSize: 12, marginBottom: 8 },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6, marginHorizontal: -4 },
  actionBtn: { flex: 1, minWidth: 110, margin: 4, paddingVertical: 8 },
  
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#FFF', marginBottom: 6 },
  lineaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginBottom: 8
  },
  lineaName: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  lineaNotas: { fontSize: 12, color: '#C6BFFF', marginVertical: 2 },
  statusDotSmall: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  lineaEstadoText: { fontSize: 12, fontWeight: '700' },
  deleteItemBtn: { padding: 4 },
  deleteItemText: { color: '#F87171', fontWeight: 'bold', fontSize: 16, paddingHorizontal: 8 },
  
  emptyText: { color: '#A5A5B1', textAlign: 'center', marginTop: 24, fontSize: 14 },
  bottomFlowActions: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 8, marginTop: 4 },
  flowBtn: { width: '100%', marginTop: 4 },
  warningText: { textAlign: 'center', color: '#F87171', marginTop: 4, fontSize: 11, fontWeight: '600' },
  
  emptyDetailContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyDetailText: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 8 },
  emptyDetailSub: { fontSize: 13, color: '#A5A5B1', textAlign: 'center', lineHeight: 18 },
  
  // Modales
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { 
    backgroundColor: '#1A1D27', 
    borderRadius: 24, 
    padding: 24, 
    width: '100%', 
    maxWidth: 450,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#A5A5B1', textAlign: 'center', marginBottom: 12 },
  mesaLibreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)'
  },
  mesaLibreRowChecked: { backgroundColor: 'rgba(198,191,255,0.05)' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#A5A5B1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#C6BFFF',
    backgroundColor: '#C6BFFF',
  },
  checkMark: {
    color: '#0C0E14',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalButtons: { flexDirection: 'row', marginTop: 16 },
});
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/axiosConfig';
import Loader from '../components/Loader';
import Button from '../components/Button';
import CatalogModal from '../components/CatalogModal';

export default function MesaDetailScreen({ route, navigation }: any) {
  const { mesaId, mesaNumero, estado: initialState, unionId: initialUnionId } = route.params;
  
  const [estado, setEstado] = useState(initialState);
  const [comandaId, setComandaId] = useState<number | null>(null);
  const [lineas, setLineas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogVisible, setCatalogVisible] = useState(false);
  
  // Union states
  const [unionId, setUnionId] = useState<number | null>(initialUnionId || null);
  const [unirModalVisible, setUnirModalVisible] = useState(false);
  const [mesasLibres, setMesasLibres] = useState<any[]>([]);

  const fetchComandaActiva = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/comandas/mesa/${mesaId}/activa/`);
      const payload = res.data.data ? res.data.data : res.data;
      if (res.data.ok) {
        setEstado(payload.estado);
        setComandaId(payload.comanda_id);
        setLineas(payload.lineas || []);
      }
    } catch (e: any) {
      if (e.response?.status === 404) {
        if (initialState === 'LIMPIEZA' || initialState === 'POR_PAGAR') {
          setEstado(initialState);
        } else {
          setEstado('LIBRE');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComandaActiva();
    
    // Polling cada 10 segundos
    const interval = setInterval(() => {
      fetchComandaActiva();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const liberarMesa = async () => {
    try {
      const res = await apiClient.post(`/comandas/mesa/${mesaId}/liberar/`);
      if (res.data.ok) {
        navigation.goBack();
      }
    } catch (e: any) {
      const msg = e.response?.data?.errors?.[0]?.detail || e.response?.data?.message || e.response?.data?.error || 'Error liberando mesa';
      Alert.alert('Error', msg);
    }
  };

  const marcarLimpia = async () => {
    try {
      const res = await apiClient.post(`/mesas/${mesaId}/limpiada/`);
      if (res.data.ok) {
        Alert.alert('Éxito', 'La mesa ha sido liberada para nuevas reservas.');
        navigation.goBack();
      }
    } catch (e: any) {
      const msg = e.response?.data?.errors?.[0]?.detail || e.response?.data?.message || e.response?.data?.error || 'Error al liberar mesa';
      Alert.alert('Error', msg);
    }
  };

  const onSendCart = async (cart: any[]) => {
    if (cart.length === 0) return;
    
    try {
      if (!comandaId) {
        // Crear la comanda con todos los platos del carrito
        const res = await apiClient.post('/comandas/crear/', {
          mesa_id: mesaId,
          items: cart.map(item => ({ plato_id: item.plato_id, cantidad: item.cantidad, notas: item.notas }))
        });
        if (res.data.ok) {
          setCatalogVisible(false);
          fetchComandaActiva();
        }
      } else {
        // Si ya hay comanda, agregar los platos uno por uno ya que el endpoint acepta de a uno
        for (const item of cart) {
          await apiClient.post(`/comandas/${comandaId}/platos/`, { 
            plato_id: item.plato_id, 
            cantidad: item.cantidad, 
            notas: item.notas 
          });
        }
        setCatalogVisible(false);
        fetchComandaActiva();
      }
    } catch (e: any) {
      const msg = e.response?.data?.errors?.[0]?.detail || e.response?.data?.message || e.response?.data?.error || 'Error enviando carrito';
      Alert.alert('Error', msg);
    }
  };

  const entregarPedido = async () => {
    if (!comandaId) return;
    try {
      const res = await apiClient.post(`/comandas/${comandaId}/entregar/`);
      if (res.data.ok) {
        Alert.alert('Éxito', res.data.message);
        fetchComandaActiva();
      }
    } catch (e: any) {
      const msg = e.response?.data?.errors?.[0]?.detail || e.response?.data?.message || e.response?.data?.error || 'Error entregando pedido';
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
                fetchComandaActiva();
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

  const fetchMesasLibres = async () => {
    try {
      // Necesito traer todas y filtrar, o si hay un endpoint /mesas/libres/
      const res = await apiClient.get('/mesas/libres/');
      if (res.data.pisos) {
        const libres = [];
        for (const [piso, mesas] of Object.entries(res.data.pisos)) {
          for (const m of (mesas as any[])) {
            if (m.id !== mesaId && m.es_grupo === false && m.union_id === null) {
              libres.push(m);
            }
          }
        }
        setMesasLibres(libres);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openUnirModal = () => {
    fetchMesasLibres();
    setUnirModalVisible(true);
  };

  const unirMesa = async (secundariaId: number) => {
    Alert.alert('Confirmar', '¿Unir con esta mesa?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Unir', onPress: async () => {
          try {
            const res = await apiClient.post('/mesas/union/crear/', {
              mesa_principal_id: mesaId,
              mesa_secundaria_ids: [secundariaId]
            });
            if (res.data.ok) {
              setUnionId(res.data.union.id);
              setUnirModalVisible(false);
              Alert.alert('Éxito', 'Mesas unidas. Recarga el salón para ver los cambios completos.');
            }
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Error uniendo mesas');
          }
        }
      }
    ]);
  };

  const disolverUnion = async () => {
    if (!unionId) return;
    Alert.alert('Confirmar', '¿Deshacer la unión de estas mesas?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Disolver', style: 'destructive', onPress: async () => {
          try {
            const res = await apiClient.delete(`/mesas/union/${unionId}/disolver/`);
            if (res.data.ok) {
              setUnionId(null);
              Alert.alert('Éxito', 'Unión disuelta.');
            }
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Error disolviendo unión');
          }
        }
      }
    ]);
  };

  const getMesaColor = (estadoStr: string) => {
    switch (estadoStr) {
      case 'LIBRE': return '#4EDEA3';
      case 'OCUPADA': return '#F87171';
      case 'ATENDIENDO': return '#FBBF24';
      case 'POR_COBRAR': return '#60A5FA';
      case 'LIMPIEZA': return '#F97316';
      case 'ENTREGADO': return '#FBBF24';
      default: return '#A5A5B1';
    }
  };

  const getLineaColor = (estadoLinea: string) => {
    if (estadoLinea === 'LISTO') return '#4EDEA3';
    if (estadoLinea === 'EN PREP' || estadoLinea === 'EN_PREP') return '#FBBF24';
    return '#A5A5B1';
  };

  const renderLinea = ({ item }: { item: any }) => (
    <View style={styles.lineaRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineaName}>{item.cantidad}x {item.plato_nombre}</Text>
        {!!item.observacion && <Text style={styles.lineaNotas}>Notas: {item.observacion}</Text>}
        <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
          <View style={[styles.statusDotSmall, {backgroundColor: getLineaColor(item.estado)}]} />
          <Text style={[styles.lineaEstado, {color: getLineaColor(item.estado)}]}>{item.estado}</Text>
        </View>
      </View>
      {item.estado === 'PENDIENTE' && (
        <TouchableOpacity onPress={() => eliminarLinea(item.id)}>
          <Text style={{color: '#F87171', fontWeight: 'bold', padding: 8, fontSize: 18}}>X</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const hayListos = Array.isArray(lineas) && lineas.some(l => l.estado === 'LISTO');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button title="Volver" onPress={() => navigation.goBack()} variant="secondary" style={{ padding: 8, paddingHorizontal: 16 }} />
        <Text style={styles.title}>Mesa {mesaNumero}</Text>
        <TouchableOpacity onPress={fetchComandaActiva} style={{ padding: 8, justifyContent: 'center' }}>
          <Text style={{ color: '#C6BFFF', fontWeight: 'bold' }}>Refrescar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Loader color="#C6BFFF" />
      ) : (
        <View style={styles.content}>
          <View style={styles.estadoContainer}>
            <View style={[styles.statusIndicator, {backgroundColor: getMesaColor(estado)}]} />
            <Text style={styles.estadoText}>Estado: {estado}</Text>
          </View>
          
          {estado !== 'LIMPIEZA' && estado !== 'POR_PAGAR' && (
            <Button title="Añadir Platos / Carrito" onPress={() => setCatalogVisible(true)} variant="primary" style={styles.actionBtn} />
          )}
          
          {estado === 'LIBRE' && !unionId && (
            <Button title="Unir con otra mesa" onPress={openUnirModal} variant="secondary" style={styles.actionBtn} />
          )}

          {!!unionId && (
            <Button title="Disolver Unión" onPress={disolverUnion} variant="danger" style={styles.actionBtn} />
          )}

          {estado === 'LIMPIEZA' && (
            <Button 
              title="Marcar como Limpia (Liberar Mesa)" 
              onPress={marcarLimpia} 
              variant="success" 
              style={[styles.actionBtn, { marginBottom: 16 }]} 
            />
          )}
          
          {estado !== 'LIBRE' && estado !== 'LIMPIEZA' && (
            <>
              <Text style={{ marginTop: 24, fontSize: 18, fontWeight: '800', marginLeft: 16, color: '#FFF' }}>Pedidos:</Text>
              <FlatList
                data={lineas}
                keyExtractor={item => item.id.toString()}
                renderItem={renderLinea}
                contentContainerStyle={{ padding: 16 }}
              />

              {hayListos && (
                <Button title="Entregar Platos Listos" onPress={entregarPedido} variant="success" style={styles.actionBtn} />
              )}
              
              {estado !== 'POR_PAGAR' && (
                <>
                  <Button 
                    title="Enviar a Caja / Liberar" 
                    onPress={liberarMesa} 
                    variant="danger" 
                    style={[styles.actionBtn, { marginBottom: 16 }]} 
                    disabled={lineas.some(l => l.estado === 'PENDIENTE' || l.estado === 'EN PREP' || l.estado === 'EN_PREP')}
                  />
                  {lineas.some(l => l.estado === 'PENDIENTE' || l.estado === 'EN PREP' || l.estado === 'EN_PREP') && (
                    <Text style={{textAlign: 'center', color: '#F87171', marginHorizontal: 16, marginBottom: 16, fontSize: 13}}>
                      No puedes enviar a caja si hay platos en cocina.
                    </Text>
                  )}
                </>
              )}
            </>
          )}
        </View>
      )}

      <CatalogModal visible={catalogVisible} onClose={() => setCatalogVisible(false)} onSendCart={onSendCart} />

      {/* Modal Unir Mesas */}
      <Modal visible={unirModalVisible} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mesas Libres Disponibles</Text>
            <ScrollView style={{maxHeight: 300, marginVertical: 16}}>
              {mesasLibres.length === 0 ? (
                <Text style={{textAlign: 'center', color: '#A5A5B1', marginTop: 20}}>No hay mesas libres para unir.</Text>
              ) : (
                mesasLibres.map(m => (
                  <TouchableOpacity key={m.id} style={styles.mesaLibreRow} onPress={() => unirMesa(m.id)}>
                    <Text style={{fontSize: 16, fontWeight: '700', color: '#FFF'}}>{m.label}</Text>
                    <Text style={{color: '#C6BFFF', fontWeight: 'bold'}}>Unir</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <Button title="Cancelar" onPress={() => setUnirModalVisible(false)} variant="secondary" />
          </View>
        </View>
      </Modal>
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
  title: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  content: { flex: 1, paddingTop: 16 },
  
  estadoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: '#1A1D27',
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  estadoText: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  
  actionBtn: { marginHorizontal: 16, marginTop: 10 },
  
  lineaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    marginBottom: 12
  },
  lineaName: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  lineaNotas: { fontSize: 13, color: '#C6BFFF', marginVertical: 4 },
  statusDotSmall: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  lineaEstado: { fontSize: 13, fontWeight: '700' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { 
    backgroundColor: '#1A1D27', 
    borderRadius: 24, 
    padding: 24, 
    width: '100%', 
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#FFF' },
  mesaLibreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)'
  }
});
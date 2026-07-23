import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Modal, TextInput, TouchableOpacity, Vibration, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/axiosConfig';
import Loader from '../components/Loader';
import Button from '../components/Button';

interface UndoTimer {
  targetState: string;
  secondsLeft: number;
}

export default function KdsScreen({ navigation }: any) {
  const [comandas, setComandas] = useState<any[]>([]);
  const [resumen, setResumen] = useState<any>({ total_pedidos: 0, pedidos_urgentes: 0, recien_llegados: 0 });
  const [loading, setLoading] = useState(true);
  
  // Ticking state for live stopwatch rendering
  const [tick, setTick] = useState(0);

  // Undo Timer states
  const [timers, setTimers] = useState<Record<number, UndoTimer>>({});
  const timersRef = useRef<Record<number, UndoTimer>>({});
  const intervalsRef = useRef<Record<number, NodeJS.Timeout>>({});

  // Audio/Vibration notification trackers
  const knownComandas = useRef<Set<number>>(new Set());
  const alertedUrgencies = useRef<Set<number>>(new Set());

  // Modal para Anular/Cancelar
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedLinea, setSelectedLinea] = useState<any | null>(null);
  const [motivo, setMotivo] = useState('');
  const [cantidadParaCocinar, setCantidadParaCocinar] = useState(0); // 0 significa cancelar todo
  const [showPicker, setShowPicker] = useState(false);

  const ws = useRef<WebSocket | null>(null);

  const fetchData = async () => {
    try {
      const [resComandas, resResumen] = await Promise.all([
        apiClient.get('/cocina/comandas-activas/'),
        apiClient.get('/cocina/resumen/')
      ]);
      const listComandas = resComandas.data?.data || resComandas.data || [];
      
      // Ordenar comandas: urgentes primero (apertura > 15m), luego alertas (apertura > 10m), y luego por fecha
      const sortedComandas = [...listComandas].sort((a: any, b: any) => {
        const tA = new Date(a.fecha_apertura).getTime();
        const tB = new Date(b.fecha_apertura).getTime();
        const minsA = Math.floor((Date.now() - tA) / 60000);
        const minsB = Math.floor((Date.now() - tB) / 60000);

        let priorityA = 0;
        if (minsA >= 15) priorityA = 2;
        else if (minsA >= 10) priorityA = 1;

        let priorityB = 0;
        if (minsB >= 15) priorityB = 2;
        else if (minsB >= 10) priorityB = 1;

        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Mayor prioridad primero
        }
        return tA - tB; // Mismo nivel: más antiguo primero
      });

      setComandas(sortedComandas);
      setResumen(resResumen.data?.data || resResumen.data || {});

      // --- Notificaciones físicas y de red (Vibración) ---
      let hasNew = false;
      let hasNewUrgent = false;

      sortedComandas.forEach((c: any) => {
        // Verificar si es un pedido nuevo
        if (!knownComandas.current.has(c.id)) {
          knownComandas.current.add(c.id);
          hasNew = true;
        }

        // Verificar si se ha vuelto urgente
        const elapsed = Math.floor((Date.now() - new Date(c.fecha_apertura).getTime()) / 60000);
        if (elapsed >= 15 && !alertedUrgencies.current.has(c.id)) {
          alertedUrgencies.current.add(c.id);
          hasNewUrgent = true;
        }
      });

      if (hasNewUrgent) {
        // Vibración larga para advertencia urgente
        Vibration.vibrate([0, 500, 100, 500]);
      } else if (hasNew && knownComandas.current.size > sortedComandas.length) {
        // Vibración corta doble para nuevo pedido
        Vibration.vibrate([0, 150, 100, 150]);
      }

    } catch (error) {
      console.error('Error fetching kitchen data:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = async () => {
    const token = await AsyncStorage.getItem('access_token');
    if (!token) return;

    const baseURL = apiClient.defaults.baseURL || 'http://192.168.100.13:8002/api/v1';
    const wsProtocol = baseURL.startsWith('https') ? 'wss:' : 'ws:';
    const host = baseURL.split('//')[1].split('/')[0];
    const wsUrl = `${wsProtocol}//${host}/ws/cocina/kds/?token=${token}`;
    
    ws.current = new WebSocket(wsUrl);
    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'update_kds') {
        fetchData();
      }
    };
  };

  useEffect(() => {
    fetchData();
    connectWebSocket();
    
    // Intervalo de ticking para stopwatches y barra de progreso (cada 1s)
    const tickInterval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => {
      if (ws.current) ws.current.close();
      clearInterval(tickInterval);
      // Limpiar timers activos al desmontar
      Object.values(intervalsRef.current).forEach(clearInterval);
    };
  }, []);

  // Iniciar timer local de 10s (Undo)
  const startUndoTimer = (lineaId: number, targetState: string) => {
    // Si ya tiene un timer corriendo, lo ignoramos
    if (timers[lineaId]) return;

    const initialTimer = { targetState, secondsLeft: 10 };
    setTimers(prev => ({ ...prev, [lineaId]: initialTimer }));
    timersRef.current[lineaId] = initialTimer;

    intervalsRef.current[lineaId] = setInterval(() => {
      const current = timersRef.current[lineaId];
      if (!current) return;

      const updated = { ...current, secondsLeft: current.secondsLeft - 1 };
      
      if (updated.secondsLeft <= 0) {
        // Expiró: enviar petición definitiva al servidor
        clearInterval(intervalsRef.current[lineaId]);
        delete intervalsRef.current[lineaId];
        
        setTimers(prev => {
          const next = { ...prev };
          delete next[lineaId];
          return next;
        });
        delete timersRef.current[lineaId];

        cambiarEstadoDefinitivo(lineaId, targetState);
      } else {
        setTimers(prev => ({ ...prev, [lineaId]: updated }));
        timersRef.current[lineaId] = updated;
      }
    }, 1000);
  };

  const cancelUndoTimer = (lineaId: number) => {
    if (intervalsRef.current[lineaId]) {
      clearInterval(intervalsRef.current[lineaId]);
      delete intervalsRef.current[lineaId];
    }
    setTimers(prev => {
      const next = { ...prev };
      delete next[lineaId];
      return next;
    });
    delete timersRef.current[lineaId];
    Vibration.vibrate(100); // Pequeña vibración de retroalimentación
  };

  const cambiarEstadoDefinitivo = async (lineaId: number, nuevoEstado: string, evtMotivo = '', evtCant = 0) => {
    try {
      const res = await apiClient.patch(`/cocina/lineas/${lineaId}/cambiar-estado/`, { 
        nuevo_estado: nuevoEstado,
        motivo: evtMotivo,
        cantidad_parcial: evtCant
      });
      if (res.data.ok) {
        fetchData();
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Error al cambiar de estado');
    }
  };

  const openCancelModal = (linea: any) => {
    setSelectedLinea(linea);
    setMotivo('');
    setCantidadParaCocinar(0); // Por defecto cancelar todo
    setShowPicker(false);
    setCancelModalVisible(true);
  };

  const submitCancel = () => {
    if (!selectedLinea) return;
    if (!motivo.trim() || motivo.trim().length < 5) {
      Alert.alert('Motivo requerido', 'Debes ingresar un motivo de anulación válido (mínimo 5 caracteres).');
      return;
    }
    
    // cantidadParaCocinar representa la cantidad que se va a cocinar. 
    // Si se envía > 0, el backend cancela la diferencia.
    // Ej: plato tiene cantidad N. Si queremos cocinar K, enviamos K.
    cambiarEstadoDefinitivo(selectedLinea.id, 'ANULADO', motivo, cantidadParaCocinar);
    setCancelModalVisible(false);
    setSelectedLinea(null);
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  // Renderizado de línea individual de plato
  const renderLinea = (linea: any) => {
    const isPrep = linea.estado === 'EN_PREP' && linea.fecha_inicio_prep_iso;
    const tiempoEstimado = linea.tiempo_estimado || 0;
    
    let elapsedText = '—';
    let isExceeded = false;
    let isCritical = false;
    let progressPct = 0;
    
    if (isPrep) {
      const startMs = new Date(linea.fecha_inicio_prep_iso).getTime();
      const elapsedMs = Date.now() - startMs;
      const mins = Math.floor(elapsedMs / 60000);
      const secs = Math.floor((elapsedMs % 60000) / 1000);
      elapsedText = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
      
      const totalSecs = Math.floor(elapsedMs / 1000);
      const estSecs = tiempoEstimado * 60;
      
      if (tiempoEstimado > 0) {
        progressPct = Math.min((totalSecs / estSecs) * 100, 100);
        if (totalSecs > estSecs * 1.5) {
          isCritical = true;
          isExceeded = true;
        } else if (totalSecs > estSecs) {
          isExceeded = true;
        }
      }
    }

    const timerActive = timers[linea.id];

    return (
      <View style={[styles.lineaRow, isCritical && styles.lineaRowCritical]}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.lineaName}>{linea.cantidad}x {linea.plato_nombre}</Text>
          {!!linea.observacion && <Text style={styles.lineaNotas}>Notas: {linea.observacion}</Text>}
          
          <View style={styles.lineaMetaRow}>
            <View style={[styles.statusDotSmall, { backgroundColor: linea.estado === 'LISTO' ? '#4EDEA3' : '#FBBF24' }]} />
            <Text style={styles.lineaEstado}>{linea.estado_display}</Text>
            
            {/* Cronómetro visual */}
            {isPrep && (
              <Text style={[styles.stopwatchText, isExceeded && styles.textRed, isCritical && styles.textCritical]}>
                {elapsedText} {tiempoEstimado > 0 && `(Est: ${tiempoEstimado}m)`}
              </Text>
            )}
          </View>

          {/* Barra de progreso de preparación */}
          {isPrep && tiempoEstimado > 0 && (
            <View style={styles.progressContainer}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${progressPct}%`,
                    backgroundColor: isExceeded ? '#F87171' : progressPct >= 75 ? '#FBBF24' : '#4EDEA3' 
                  }
                ]} 
              />
            </View>
          )}
        </View>

        {/* Acciones de Cocina con soporte de Deshacer */}
        <View style={styles.lineaActions}>
          {timerActive ? (
            <TouchableOpacity 
              onPress={() => cancelUndoTimer(linea.id)}
              style={styles.undoBtn}
            >
              <Text style={styles.undoBtnText}>Deshacer ({timerActive.secondsLeft}s)</Text>
            </TouchableOpacity>
          ) : (
            <>
              {linea.estado === 'PENDIENTE' && (
                <Button 
                  title="Recibir" 
                  onPress={() => startUndoTimer(linea.id, 'EN_PREP')} 
                  variant="primary" 
                  style={styles.miniBtn} 
                />
              )}
              {linea.estado === 'EN_PREP' && (
                <Button 
                  title="Listo" 
                  onPress={() => startUndoTimer(linea.id, 'LISTO')} 
                  variant="success" 
                  style={styles.miniBtn} 
                />
              )}
              {linea.estado !== 'LISTO' && (
                <TouchableOpacity onPress={() => openCancelModal(linea)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  const renderComandaCard = ({ item }: { item: any }) => {
    // Calcular tiempo transcurrido de la comanda
    const startMs = new Date(item.fecha_apertura).getTime();
    const elapsedMs = Date.now() - startMs;
    const elapsedMins = Math.floor(elapsedMs / 60000);
    const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);
    
    let cardUrgencyStyle = styles.cardNormal;
    let timerBadgeStyle = styles.timerBadgeNormal;

    if (elapsedMins >= 15) {
      cardUrgencyStyle = styles.cardUrgent;
      timerBadgeStyle = styles.timerBadgeUrgent;
    } else if (elapsedMins >= 10) {
      cardUrgencyStyle = styles.cardAlert;
      timerBadgeStyle = styles.timerBadgeAlert;
    }

    return (
      <View style={[styles.comandaCard, cardUrgencyStyle]}>
        {/* Cabecera de la Comanda */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardMesaTitle}>{item.mesa_label}</Text>
          <View style={[styles.timerBadge, timerBadgeStyle]}>
            <Text style={styles.timerBadgeText}>{elapsedMins}m {elapsedSecs < 10 ? '0' : ''}{elapsedSecs}s</Text>
          </View>
        </View>
        
        <View style={styles.cardSubHeader}>
          <Text style={styles.cardSubText}>Ped: #{item.numero_pedido} | Mozo: {item.mozo_nombre}</Text>
          <Text style={styles.cardSubText}>Piso: {item.zona_nombre}</Text>
        </View>

        {!!item.observacion_general && (
          <View style={styles.generalNotes}>
            <Text style={styles.generalNotesText}>Nota: {item.observacion_general}</Text>
          </View>
        )}

        <View style={styles.linesList}>
          {item.lineas.map((linea: any) => (
            <React.Fragment key={linea.id}>
              {renderLinea(linea)}
            </React.Fragment>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={[styles.logoIcon, { fontSize: 20, fontWeight: '900', color: '#C6BFFF', marginRight: 8 }]}>OS</Text>
          <Text style={styles.title}>KDS Cocina — Pantalla Horizontal</Text>
        </View>
        <Button title="Cerrar Sesión" onPress={handleLogout} variant="danger" style={{ padding: 8, paddingHorizontal: 16 }} />
      </View>

      {/* Resumen Bar */}
      <View style={styles.resumenBar}>
        <View style={styles.resumenItem}>
          <Text style={styles.resumenLabel}>Pendientes / Prep</Text>
          <Text style={[styles.resumenValue, { color: '#FFF' }]}>{resumen.total_pedidos}</Text>
        </View>
        <View style={styles.resumenItem}>
          <Text style={styles.resumenLabel}>Pedidos Urgentes</Text>
          <Text style={[styles.resumenValue, { color: '#F87171' }]}>{resumen.pedidos_urgentes}</Text>
        </View>
        <View style={styles.resumenItem}>
          <Text style={styles.resumenLabel}>Recién Llegados</Text>
          <Text style={[styles.resumenValue, { color: '#4EDEA3' }]}>{resumen.recien_llegados}</Text>
        </View>
      </View>

      {/* Grid de 3 columnas de comandas */}
      {loading ? (
        <Loader color="#C6BFFF" />
      ) : (
        <FlatList
          data={comandas}
          keyExtractor={item => item.id.toString()}
          renderItem={renderComandaCard}
          numColumns={3}
          key="kds-grid-3-columns"
          contentContainerStyle={styles.gridContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 36, fontWeight: '900', color: '#C6BFFF', marginBottom: 16 }}>OS</Text>
              <Text style={styles.emptyText}>Sin comandas pendientes</Text>
              <Text style={styles.emptySubText}>Los pedidos enviados por los mozos aparecerán en esta pantalla automáticamente.</Text>
            </View>
          }
        />
      )}

      {/* Modal de Anulación Personalizado */}
      <Modal visible={cancelModalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Anular Plato</Text>
            <Text style={styles.modalPlatoText}>{selectedLinea?.plato_nombre} (x{selectedLinea?.cantidad})</Text>

            {/* Selector de cantidad parcial personalizado */}
            {selectedLinea && selectedLinea.cantidad > 1 && (
              <View style={styles.parcialSelectorContainer}>
                <Text style={styles.label}>Cantidad a preparar (Cocinar):</Text>
                
                <TouchableOpacity 
                  style={styles.pickerHeader} 
                  onPress={() => setShowPicker(!showPicker)}
                >
                  <Text style={styles.pickerHeaderText}>
                    {cantidadParaCocinar === 0 
                      ? `Cancelar todo (${selectedLinea.cantidad} uds.) — No cocinar ninguno` 
                      : `Cocinar ${cantidadParaCocinar} — Cancelar ${selectedLinea.cantidad - cantidadParaCocinar} uds.`}
                  </Text>
                  <Text style={{ color: '#C6BFFF', fontWeight: 'bold' }}>▼</Text>
                </TouchableOpacity>

                {showPicker && (
                  <View style={styles.pickerDropdown}>
                    <TouchableOpacity 
                      style={[styles.pickerOption, cantidadParaCocinar === 0 && styles.pickerOptionSelected]}
                      onPress={() => { setCantidadParaCocinar(0); setShowPicker(false); }}
                    >
                      <Text style={styles.pickerOptionText}>Cancelar todo (No cocinar ninguno)</Text>
                    </TouchableOpacity>
                    {Array.from({ length: selectedLinea.cantidad - 1 }, (_, i) => i + 1).map(k => (
                      <TouchableOpacity 
                        key={k}
                        style={[styles.pickerOption, cantidadParaCocinar === k && styles.pickerOptionSelected]}
                        onPress={() => { setCantidadParaCocinar(k); setShowPicker(false); }}
                      >
                        <Text style={styles.pickerOptionText}>Cocinar {k} — Cancelar {selectedLinea.cantidad - k}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={styles.parcialSummaryText}>
                  {cantidadParaCocinar === 0 
                    ? `Se cancelará el total de ${selectedLinea.cantidad} unidades.` 
                    : `Se cocinarán ${cantidadParaCocinar} unidades y se cancelarán ${selectedLinea.cantidad - cantidadParaCocinar} de forma permanente.`}
                </Text>
              </View>
            )}

            <Text style={styles.label}>Motivo de anulación (Mínimo 5 caracteres):</Text>
            <TextInput
              style={styles.input}
              placeholder="Escribe el motivo de la anulación (Requerido)..."
              placeholderTextColor="#A5A5B1"
              value={motivo}
              onChangeText={setMotivo}
              maxLength={200}
              multiline
            />
            <Text style={styles.charCountText}>{motivo.length}/200</Text>

            <View style={styles.modalButtons}>
              <Button 
                title="Volver" 
                onPress={() => setCancelModalVisible(false)} 
                variant="secondary" 
                style={{ flex: 1, marginRight: 8 }} 
              />
              <Button 
                title="Confirmar Anulación" 
                onPress={submitCancel} 
                variant="danger" 
                style={{ flex: 1 }}
                disabled={!motivo.trim() || motivo.trim().length < 5}
              />
            </View>
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
    padding: 12,
    backgroundColor: '#1A1D27',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logoIcon: { fontSize: 22, marginRight: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  
  resumenBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#12141C',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  resumenItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  resumenLabel: { fontSize: 12, color: '#A5A5B1', marginBottom: 2 },
  resumenValue: { fontSize: 22, fontWeight: '900' },

  gridContent: { padding: 12 },
  comandaCard: {
    flex: 1,
    backgroundColor: '#1A1D27',
    margin: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    minHeight: 280,
  },
  cardNormal: { borderColor: 'rgba(255,255,255,0.08)' },
  cardAlert: { borderColor: '#FBBF24', backgroundColor: '#21201B' },
  cardUrgent: { borderColor: '#F87171', backgroundColor: '#261B1B' },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardMesaTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  
  timerBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  timerBadgeNormal: { backgroundColor: 'rgba(255,255,255,0.1)' },
  timerBadgeAlert: { backgroundColor: '#FBBF24' },
  timerBadgeUrgent: { backgroundColor: '#F87171' },
  timerBadgeText: { color: '#0C0E14', fontWeight: '800', fontSize: 12 },

  cardSubHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardSubText: { color: '#A5A5B1', fontSize: 11, fontWeight: '600' },

  generalNotes: {
    backgroundColor: 'rgba(248,113,113,0.15)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
  },
  generalNotesText: { color: '#F87171', fontSize: 12, fontStyle: 'italic', fontWeight: '700' },

  linesList: { marginTop: 8 },
  
  lineaRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineaRowCritical: { backgroundColor: 'rgba(248,113,113,0.08)' },
  lineaName: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  lineaNotas: { fontSize: 11, color: '#FBBF24', fontWeight: '700', marginTop: 3 },
  lineaMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDotSmall: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  lineaEstado: { fontSize: 11, color: '#A5A5B1', fontWeight: '700' },
  stopwatchText: { fontSize: 11, color: '#4EDEA3', marginLeft: 8, fontWeight: '700' },
  textRed: { color: '#FBBF24' },
  textCritical: { color: '#F87171' },

  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  lineaActions: { flexDirection: 'row', alignItems: 'center' },
  miniBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  cancelBtn: { padding: 8, marginLeft: 8 },
  cancelBtnText: { color: '#F87171', fontSize: 16, fontWeight: '900' },
  
  undoBtn: {
    backgroundColor: '#FBBF24',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  undoBtnText: {
    color: '#0C0E14',
    fontWeight: '800',
    fontSize: 11,
  },

  // Empty states
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 60, alignSelf: 'center' },
  emptyText: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 8 },
  emptySubText: { fontSize: 13, color: '#A5A5B1', textAlign: 'center', lineHeight: 18, maxWidth: 400 },

  // Modal
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
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#F87171', textAlign: 'center', marginBottom: 8 },
  modalPlatoText: { fontSize: 16, color: '#FFF', fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  label: { color: '#A5A5B1', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#FFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    height: 80,
    textAlignVertical: 'top',
  },
  charCountText: { color: '#A5A5B1', fontSize: 11, alignSelf: 'flex-end', marginTop: 4, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', marginTop: 12 },

  // Picker
  parcialSelectorContainer: { marginBottom: 16 },
  pickerHeader: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerHeaderText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  pickerDropdown: {
    backgroundColor: '#1E2130',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  pickerOption: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  pickerOptionSelected: {
    backgroundColor: 'rgba(198,191,255,0.1)',
  },
  pickerOptionText: { color: '#FFF', fontSize: 13 },
  parcialSummaryText: { color: '#C6BFFF', fontSize: 12, marginTop: 8, fontStyle: 'italic', fontWeight: '600' },
});
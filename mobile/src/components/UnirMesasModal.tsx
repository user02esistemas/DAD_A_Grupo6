import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import apiClient from '../api/axiosConfig';
import Button from './Button';

interface UnirMesasModalProps {
  visible: boolean;
  onClose: () => void;
  selectedMesa: any;
  onSuccess: () => void;
}

export default function UnirMesasModal({ visible, onClose, selectedMesa, onSuccess }: UnirMesasModalProps) {
  const [mesasLibres, setMesasLibres] = useState<any[]>([]);
  const [selectedSecundarias, setSelectedSecundarias] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && selectedMesa) {
      setSelectedSecundarias([]);
      setMesasLibres([]);
      fetchMesasLibres();
    }
  }, [visible, selectedMesa]);

  const fetchMesasLibres = async () => {
    if (!selectedMesa || !selectedMesa.piso_label) return;
    try {
      const res = await apiClient.get('/mesas/libres/');
      if (res && res.data && res.data.pisos) {
        const libres: any[] = [];
        const mesasEnPiso = res.data.pisos[selectedMesa.piso_label];
        if (Array.isArray(mesasEnPiso)) {
          mesasEnPiso.forEach((m: any) => {
            if (m && m.id && m.id !== selectedMesa.id && m.es_grupo === false && m.union_id === null) {
              libres.push(m);
            }
          });
        }
        setMesasLibres(libres);
      }
    } catch (e) {
      console.error('Error fetching free tables:', e);
    }
  };

  const toggleSelectMesa = (id: number) => {
    if (selectedSecundarias.includes(id)) {
      setSelectedSecundarias(prev => prev.filter(x => x !== id));
    } else {
      if (selectedSecundarias.length >= 2) {
        Alert.alert('Límite de selección', 'Solo puedes seleccionar hasta 2 mesas adicionales (máximo 3 mesas en total).');
        return;
      }
      setSelectedSecundarias(prev => [...prev, id]);
    }
  };

  const confirmarUnion = async () => {
    if (selectedSecundarias.length === 0 || !selectedMesa) return;
    setLoading(true);
    try {
      const res = await apiClient.post('/mesas/union/crear/', {
        mesa_principal_id: selectedMesa.id,
        mesa_secundaria_ids: selectedSecundarias
      });
      if (res.data.ok) {
        Alert.alert('Éxito', 'Mesas unidas correctamente.');
        onSuccess();
        onClose();
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Error uniendo mesas');
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !selectedMesa) return null;

  return (
    <View style={styles.overlayContainer}>
      <View style={[styles.modalContent, { maxHeight: '90%', padding: 16, width: '90%', maxWidth: 450 }]}>
        <Text style={[styles.modalTitle, { fontSize: 18, marginBottom: 2 }]}>Unir Mesa {selectedMesa.numero}</Text>
        <Text style={[styles.modalSub, { fontSize: 12, marginBottom: 8 }]}>Selecciona hasta 2 mesas libres adicionales en {selectedMesa.piso_label}:</Text>
        
        <View style={{ height: 180, marginVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 10 }}>
            {mesasLibres.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#A5A5B1', marginTop: 20, fontSize: 13 }}>No hay mesas libres disponibles para unir en este piso.</Text>
            ) : (
              mesasLibres.map(m => {
                if (!m || !m.id) return null;
                const isChecked = selectedSecundarias.includes(m.id);
                return (
                  <TouchableOpacity 
                    key={m.id} 
                    style={[styles.mesaLibreRow, { padding: 12 }, isChecked && styles.mesaLibreRowChecked]} 
                    onPress={() => toggleSelectMesa(m.id)}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Mesa {m.numero} (Cap: {m.capacidad})</Text>
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked, { width: 20, height: 20, borderRadius: 10 }]}>
                      {isChecked && <Text style={[styles.checkMark, { fontSize: 12 }]}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        <View style={[styles.modalButtons, { marginTop: 12 }]}>
          <Button title="Cancelar" onPress={onClose} variant="secondary" style={{ flex: 1, marginRight: 8, padding: 12 }} />
          <Button 
            title={loading ? "Uniendo..." : `Confirmar Unión (${selectedSecundarias.length})`} 
            onPress={confirmarUnion} 
            variant="primary" 
            style={{ flex: 1, padding: 12 }} 
            disabled={selectedSecundarias.length === 0 || loading}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modalContent: { 
    backgroundColor: '#1A1D27', 
    borderRadius: 24, 
    width: '100%', 
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', textAlign: 'center' },
  modalSub: { color: '#A5A5B1', textAlign: 'center' },
  mesaLibreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)'
  },
  mesaLibreRowChecked: { backgroundColor: 'rgba(198,191,255,0.05)' },
  checkbox: {
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
  },
  modalButtons: { flexDirection: 'row' },
});

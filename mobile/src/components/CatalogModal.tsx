import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import apiClient from '../api/axiosConfig';
import Loader from './Loader';
import Button from './Button';

interface CartItem {
  plato_id: number;
  nombre: string;
  cantidad: number;
  precio: string;
  notas: string;
  insumo_ids_excluidos?: number[];
  insumos_excluidos_nombres?: string[];
}

interface CatalogModalProps {
  visible: boolean;
  onClose: () => void;
  onSendCart: (cart: CartItem[]) => void;
}

export default function CatalogModal({ visible, onClose, onSendCart }: CatalogModalProps) {
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [insumosStatus, setInsumosStatus] = useState<any[]>([]);
  const [notas, setNotas] = useState('');
  const [cantidad, setCantidad] = useState(1);

  // Layout tabs
  const [tab, setTab] = useState<'CATALOG' | 'CART'>('CATALOG');

  useEffect(() => {
    if (visible && catalogo.length === 0) {
      fetchCatalogo();
    }
    if (visible) {
      setCart([]);
      setTab('CATALOG');
    }
  }, [visible]);

  const fetchCatalogo = async () => {
    try {
      const res = await apiClient.get('/menu/catalogo/');
      if (res.data && res.data.categorias) {
        setCatalogo(res.data.categorias);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (selectedProduct) {
      const excluidos = insumosStatus.filter(i => !i.incluido);
      const insumo_ids_excluidos = excluidos.map(i => i.id);
      const insumos_excluidos_nombres = excluidos.map(i => i.nombre);

      setCart([...cart, {
        plato_id: selectedProduct.id,
        nombre: selectedProduct.nombre,
        precio: selectedProduct.precio,
        cantidad,
        notas,
        insumo_ids_excluidos,
        insumos_excluidos_nombres,
      }]);
      setSelectedProduct(null);
      setInsumosStatus([]);
      setNotas('');
      setCantidad(1);
    }
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const renderProducto = ({ item }: { item: any }) => (
    <View style={styles.productCard}>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.nombre}</Text>
        <Text style={styles.productPrice}>S/ {item.precio}</Text>
      </View>
      <Button 
        title="Añadir" 
        onPress={() => {
          setSelectedProduct(item);
          setCantidad(1);
          setNotas('');
          if (item.insumos && item.insumos.length > 0) {
            setInsumosStatus(item.insumos.map((ins: any) => ({ ...ins, incluido: true })));
          } else {
            setInsumosStatus([]);
          }
        }} 
        style={styles.addButton} 
        variant="secondary"
      />
    </View>
  );

  const totalCart = cart.reduce((acc, curr) => acc + (parseFloat(curr.precio) * curr.cantidad), 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Nuevo Pedido</Text>
            <Button title="Cerrar" onPress={onClose} variant="secondary" style={{padding: 8, paddingHorizontal: 16}} />
          </View>
          
          <View style={styles.tabsContainer}>
            <TouchableOpacity style={[styles.tab, tab === 'CATALOG' && styles.tabActive]} onPress={() => setTab('CATALOG')}>
              <Text style={[styles.tabText, tab === 'CATALOG' && styles.tabTextActive]}>Menú</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === 'CART' && styles.tabActive]} onPress={() => setTab('CART')}>
              <Text style={[styles.tabText, tab === 'CART' && styles.tabTextActive]}>
                Carrito ({cart.reduce((a,b)=>a+b.cantidad, 0)})
              </Text>
            </TouchableOpacity>
          </View>

          {tab === 'CATALOG' ? (
            loading ? (
              <Loader color="#C6BFFF" />
            ) : (
              <FlatList
                data={catalogo.flatMap(c => c.platos)}
                keyExtractor={item => item.id.toString()}
                renderItem={renderProducto}
                numColumns={2}
                key="catalog-list-2-columns"
                contentContainerStyle={styles.list}
              />
            )
          ) : (
            <View style={{flex: 1}}>
              <ScrollView contentContainerStyle={styles.list}>
                {cart.length === 0 ? (
                  <Text style={{textAlign: 'center', marginTop: 20, color: '#A5A5B1'}}>El carrito está vacío.</Text>
                ) : (
                  cart.map((item, index) => (
                    <View key={index} style={styles.productRow}>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>{item.cantidad}x {item.nombre}</Text>
                        {!!item.insumos_excluidos_nombres && item.insumos_excluidos_nombres.length > 0 && (
                          <Text style={{fontSize: 12, color: '#FBBF24', fontWeight: 'bold'}}>Sin: {item.insumos_excluidos_nombres.join(', ')}</Text>
                        )}
                        {!!item.notas && <Text style={{fontSize: 12, color: '#C6BFFF'}}>Notas: {item.notas}</Text>}
                        <Text style={styles.productPrice}>S/ {(parseFloat(item.precio) * item.cantidad).toFixed(2)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeFromCart(index)}>
                        <Text style={{color: '#F87171', fontWeight: 'bold', padding: 8, fontSize: 18}}>X</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
              
              {cart.length > 0 && (
                <View style={styles.cartFooter}>
                  <Text style={{fontSize: 18, fontWeight: 'bold', color: '#FFF'}}>Total: S/ {totalCart.toFixed(2)}</Text>
                  <Button title="Enviar a Cocina" onPress={() => onSendCart(cart)} variant="primary" style={{ minWidth: 150 }} />
                </View>
              )}
            </View>
          )}

          {/* Modal interno o panel inferior para detalles del plato */}
          {selectedProduct && tab === 'CATALOG' && (
            <View style={styles.detailsPanel}>
              <Text style={styles.detailsTitle}>Añadir {selectedProduct.nombre}</Text>
              
              <View style={styles.cantidadContainer}>
                <Button title="-" onPress={() => setCantidad(Math.max(1, cantidad - 1))} style={styles.qtyBtn} variant="secondary" />
                <Text style={styles.qtyText}>{cantidad}</Text>
                <Button title="+" onPress={() => setCantidad(cantidad + 1)} style={styles.qtyBtn} variant="secondary" />
              </View>

              {/* Personalización de Insumos */}
              {insumosStatus.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FBBF24', marginBottom: 6 }}>
                    Ingredientes (Toca para quitar):
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {insumosStatus.map((ins, idx) => (
                      <TouchableOpacity
                        key={ins.id}
                        onPress={() => {
                          const updated = [...insumosStatus];
                          updated[idx].incluido = !updated[idx].incluido;
                          setInsumosStatus(updated);
                        }}
                        style={{
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          borderWidth: 1,
                          backgroundColor: ins.incluido ? 'rgba(78, 222, 163, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                          borderColor: ins.incluido ? '#4EDEA3' : '#F87171'
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: ins.incluido ? '#4EDEA3' : '#F87171', textDecorationLine: ins.incluido ? 'none' : 'line-through' }}>
                          {ins.incluido ? `✓ ${ins.nombre}` : `✕ Sin ${ins.nombre}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="Notas adicionales (ej. término medio...)"
                placeholderTextColor="#A5A5B1"
                value={notas}
                onChangeText={setNotas}
                multiline
              />
              
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <Button title="Cancelar" onPress={() => setSelectedProduct(null)} variant="secondary" style={{flex:1, marginRight: 8}} />
                <Button title="Agregar al carrito" onPress={handleAddToCart} variant="primary" style={{flex:1}} />
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  title: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  
  tabsContainer: { flexDirection: 'row', backgroundColor: '#1A1D27', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#C6BFFF' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#A5A5B1' },
  tabTextActive: { color: '#C6BFFF' },

  list: { padding: 8, paddingBottom: 100 },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  productCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
    margin: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'space-between',
    minHeight: 130,
  },
  productInfo: { flex: 1, marginBottom: 8 },
  productName: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  productPrice: { fontSize: 14, color: '#4EDEA3', marginTop: 4, fontWeight: '700' },
  addButton: { paddingVertical: 8, paddingHorizontal: 12, width: '100%' },
  
  detailsPanel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#1A1D27',
    padding: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -10},
    shadowOpacity: 0.5,
    shadowRadius: 20
  },
  detailsTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#FFF' },
  cantidadContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  qtyBtn: { width: 44, height: 44, padding: 0 },
  qtyText: { fontSize: 22, fontWeight: 'bold', marginHorizontal: 20, color: '#FFF' },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    height: 90,
    textAlignVertical: 'top',
    marginBottom: 20,
    color: '#FFF',
    fontSize: 15
  },
  cartFooter: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    backgroundColor: '#1A1D27',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  }
});
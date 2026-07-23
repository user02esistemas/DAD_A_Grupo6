import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Loader({ color = '#C6BFFF', size = 'large' }: { color?: string, size?: 'small' | 'large' }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

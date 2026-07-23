import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  loading?: boolean;
  disabled?: boolean;
  style?: import('react-native').StyleProp<ViewStyle>;
  textStyle?: import('react-native').StyleProp<TextStyle>;
}

export default function Button({ 
  title, 
  onPress, 
  variant = 'primary', 
  loading = false, 
  disabled = false,
  style,
  textStyle 
}: ButtonProps) {
  
  const getContainerStyle = () => {
    if (disabled) return styles.disabledContainer;
    switch (variant) {
      case 'primary': return {}; // Handled by LinearGradient
      case 'secondary': return styles.secondaryContainer;
      case 'danger': return styles.dangerContainer;
      case 'success': return styles.successContainer;
      default: return {};
    }
  };

  const getTextColor = () => {
    if (disabled) return '#A5A5B1'; // on-surface-variant
    switch (variant) {
      case 'primary': return '#0C0E14'; // background color (dark) on bright gradient
      case 'secondary': return '#FFFFFF';
      case 'danger': return '#F87171'; // red-400
      case 'success': return '#4EDEA3'; // secondary web color
      default: return '#0C0E14';
    }
  };

  const content = loading ? (
    <ActivityIndicator color={getTextColor()} />
  ) : (
    <Text style={[styles.text, { color: getTextColor() }, textStyle]}>{title}</Text>
  );

  if (variant === 'primary' && !disabled) {
    return (
      <TouchableOpacity onPress={onPress} disabled={loading} style={[styles.touchable, style]}>
        <LinearGradient 
          colors={['#C6BFFF', '#4EDEA3']} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }}
          style={styles.gradientContainer}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.baseContainer, getContainerStyle(), style]} 
      onPress={onPress} 
      disabled={disabled || loading}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginVertical: 6,
    borderRadius: 12,
  },
  gradientContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  secondaryContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  dangerContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  successContainer: {
    backgroundColor: 'rgba(78, 222, 163, 0.1)',
    borderColor: 'rgba(78, 222, 163, 0.3)',
  },
  disabledContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

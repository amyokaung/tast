// GGUF Model Management Screen for Android Phone Storage
import React from 'react';
import { SafeAreaView, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useModelStore } from '../store/modelStore';

export const ModelScreen = () => {
  const { models, importModelFromStorage, selectActiveModel } = useModelStore();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#090d16', padding: 16 }}>
      <TouchableOpacity onPress={importModelFromStorage} style={{ backgroundColor: '#4f46e5', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>📥 ဖုန်းထဲမှ Import မည်</Text>
      </TouchableOpacity>
      <FlatList
        data={models}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => selectActiveModel(item)} style={{ backgroundColor: '#1e293b', padding: 14, marginVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{item.name}</Text>
            <Text style={{ color: '#94a3b8' }}>{item.sizeFormatted} • {item.quantization}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};
// React Native Myanmar Unicode Chat Interface with llama.cpp streaming
import React from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import { useChatStore } from '../store/chatStore';
import { MessageList } from '../components/MessageList';
import { ChatInput } from '../components/ChatInput';

export const ChatScreen = () => {
  const { messages, streamingMessageContent, isGenerating, sendMessage, stopGeneration } = useChatStore();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#090d16' }}>
      <View style={{ padding: 16, borderBottomWidth: 1, borderColor: '#1e293b' }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>ခေတ္တရာ AI (Offline)</Text>
      </View>
      <MessageList messages={messages} streamingContent={streamingMessageContent} isGenerating={isGenerating} />
      <ChatInput onSend={(t) => sendMessage(t, {}, 'GGUF')} onStop={stopGeneration} isGenerating={isGenerating} isModelReady={true} />
    </SafeAreaView>
  );
};
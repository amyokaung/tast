import { create } from 'zustand';
import { ChatMessage, Conversation, GenerationStats } from '../types/chat';
import { DatabaseService } from '../services/database';
import { LlamaService } from '../services/llama';

export const useChatStore = create<any>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isGenerating: false,
  streamingMessageContent: '',

  sendMessage: async (text: string, config: any, modelName: string) => {
    const userMsg = { id: `msg_${Date.now()}`, role: 'user', content: text, createdAt: Date.now() };
    set({ messages: [...get().messages, userMsg], isGenerating: true, streamingMessageContent: '' });

    let accumulated = '';
    await LlamaService.generateStreaming(text, config, (tok, done, stats) => {
      if (!done) {
        accumulated += tok;
        set({ streamingMessageContent: accumulated });
      } else {
        const assistantMsg = { id: `msg_a_${Date.now()}`, role: 'assistant', content: accumulated, createdAt: Date.now() };
        set({ messages: [...get().messages, assistantMsg], streamingMessageContent: '', isGenerating: false });
      }
    });
  },

  stopGeneration: () => {
    LlamaService.stopGeneration();
    set({ isGenerating: false });
  },
}));
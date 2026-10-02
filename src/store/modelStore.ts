import { create } from 'zustand';
import DocumentPicker from 'react-native-document-picker';

export interface ModelInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  quantization: string;
}

interface ModelStore {
  models: ModelInfo[];
  activeModel: ModelInfo | null;
  importModelFromStorage: () => Promise<void>;
  selectActiveModel: (model: ModelInfo) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const detectQuantization = (fileName: string): string => {
  const name = fileName.toUpperCase();

  const patterns = [
    'Q2_K',
    'Q3_K_S',
    'Q3_K_M',
    'Q3_K_L',
    'Q4_0',
    'Q4_1',
    'Q4_K_S',
    'Q4_K_M',
    'Q5_0',
    'Q5_1',
    'Q5_K_S',
    'Q5_K_M',
    'Q6_K',
    'Q8_0',
    'F16',
    'F32',
  ];

  const found = patterns.find((item) => name.includes(item));

  return found ?? 'GGUF';
};

export const useModelStore = create<ModelStore>((set) => ({
  models: [],
  activeModel: null,

  importModelFromStorage: async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        allowMultiSelection: false,
      });

      const file = result[0];

      if (!file) {
        return;
      }

      const fileName = file.name ?? 'Unknown Model';

      if (!fileName.toLowerCase().endsWith('.gguf')) {
        console.warn('Selected file is not a GGUF model.');
        return;
      }

      const model: ModelInfo = {
        id: `${file.uri}_${Date.now()}`,
        name: fileName,
        path: file.uri,
        size: file.size ?? 0,
        sizeFormatted: formatFileSize(file.size ?? 0),
        quantization: detectQuantization(fileName),
      };

      set((state) => ({
        models: [
          ...state.models.filter((item) => item.path !== model.path),
          model,
        ],
        activeModel: model,
      }));
    } catch (error: any) {
      if (DocumentPicker.isCancel(error)) {
        return;
      }

      console.error('Failed to import GGUF model:', error);
    }
  },

  selectActiveModel: (model) => {
    set({
      activeModel: model,
    });
  },
}));

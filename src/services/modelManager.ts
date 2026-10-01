import DocumentPicker, { types } from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GGUFModelItem, QuantizationType } from '../types/model';

const STORAGE_KEY_MODELS = '@khittara_imported_models';
const STORAGE_KEY_ACTIVE_MODEL = '@khittara_active_model_id';

export class ModelManagerService {
  static async pickAndImportGGUF(): Promise<GGUFModelItem> {
    const res = await DocumentPicker.pickSingle({
      type: [types.allFiles],
      copyTo: 'cachesDirectory',
    });

    const fileName = res.name || 'unnamed-model.gguf';
    if (!fileName.toLowerCase().endsWith('.gguf')) {
      throw new Error('ရွေးချယ်ထားသော ဖိုင်သည် .gguf ဖော်မတ်မဟုတ်ပါ။');
    }

    const targetDir = `${RNFS.DocumentDirectoryPath}/models`;
    if (!(await RNFS.exists(targetDir))) {
      await RNFS.mkdir(targetDir);
    }

    const destinationPath = `${targetDir}/${fileName}`;
    if (!(await RNFS.exists(destinationPath))) {
      await RNFS.copyFile((res.fileCopyUri || res.uri).replace('file://', ''), destinationPath);
    }

    const fileStat = await RNFS.stat(destinationPath);
    const sizeBytes = Number(fileStat.size) || 0;

    const newModel: GGUFModelItem = {
      id: `custom-${Date.now()}`,
      name: fileName.replace(/\.gguf$/i, ''),
      filename: fileName,
      path: destinationPath,
      sizeBytes,
      sizeFormatted: (sizeBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
      quantization: 'Q4_K_M',
      contextLength: 2048,
      estimatedRamMb: Math.round((sizeBytes / (1024 * 1024)) * 1.25 + 350),
      isCustomImported: true,
      dateAdded: Date.now(),
      supportsMyanmar: true,
    };

    await this.saveImportedModel(newModel);
    return newModel;
  }

  static async getAllModels(): Promise<GGUFModelItem[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_MODELS);
    return stored ? JSON.parse(stored) : [];
  }

  static async saveImportedModel(model: GGUFModelItem): Promise<void> {
    const existing = await this.getAllModels();
    existing.push(model);
    await AsyncStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(existing));
  }
}
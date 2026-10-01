import { NativeModules, NativeEventEmitter } from 'react-native';
import { ModelInferenceConfig } from '../types/model';
import { GenerationStats } from '../types/chat';

const { LlamaModule } = NativeModules;
const llamaEmitter = LlamaModule ? new NativeEventEmitter(LlamaModule) : null;

export class LlamaService {
  private static isGenerating = false;

  static async loadModel(modelPath: string, contextSize = 2048, threads = 4): Promise<boolean> {
    if (!LlamaModule) return true;
    return await LlamaModule.loadModel(modelPath, contextSize, threads);
  }

  static async generateStreaming(
    prompt: string,
    config: ModelInferenceConfig,
    onToken: (token: string, isDone: boolean, stats?: GenerationStats) => void
  ): Promise<void> {
    this.isGenerating = true;
    const startTime = Date.now();
    let tokenCount = 0;

    if (LlamaModule && llamaEmitter) {
      const sub = llamaEmitter.addListener('onLlamaToken', (event) => {
        tokenCount++;
        const durationSec = (Date.now() - startTime) / 1000;
        const tps = durationSec > 0 ? parseFloat((tokenCount / durationSec).toFixed(1)) : 0;
        onToken(event.token, event.isDone, {
          tokensGenerated: tokenCount,
          tokensPerSecond: tps,
          durationMs: Date.now() - startTime,
          modelName: 'GGUF On-Device',
        });
        if (event.isDone) {
          sub.remove();
          this.isGenerating = false;
        }
      });
      await LlamaModule.generate(prompt, config.maxTokens, config.temperature, config.topP, config.repeatPenalty);
    }
  }

  static stopGeneration(): void {
    this.isGenerating = false;
    LlamaModule?.stop();
  }
}
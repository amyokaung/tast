#pragma once

#include <string>
#include <vector>
#include <functional>
#include <memory>
#include <atomic>
#include <mutex>

// Callback function signature for streaming tokens to React Native
using TokenCallback = std::function<void(const std::string& token, bool isFinished, int tokensGenerated)>;

struct LlamaModelParams {
    std::string modelPath;
    int contextSize = 2048;
    int nThreads = 4;
    int nGpuLayers = 0; // On Android CPU, typically 0
    bool useMmap = true;
    bool useMlock = false;
};

struct LlamaInferenceParams {
    std::string prompt;
    int maxTokens = 512;
    float temperature = 0.7f;
    float topP = 0.9f;
    float penaltyRepeat = 1.1f;
    std::vector<std::string> stopWords;
};

class KhittaraLlamaBridge {
public:
    static KhittaraLlamaBridge& getInstance();

    bool loadModel(const LlamaModelParams& params, std::string& outError);
    void unloadModel();
    bool isModelLoaded() const;

    bool generateStreaming(
        const LlamaInferenceParams& params,
        TokenCallback callback,
        std::string& outError
    );

    void stopInference();
    
    // Metadata query
    std::string getModelName() const;
    int getContextSize() const;

private:
    KhittaraLlamaBridge();
    ~KhittaraLlamaBridge();

    KhittaraLlamaBridge(const KhittaraLlamaBridge&) = delete;
    KhittaraLlamaBridge& operator=(const KhittaraLlamaBridge&) = delete;

    struct Impl;
    std::unique_ptr<Impl> pImpl;
    std::atomic<bool> isRunning{false};
    std::atomic<bool> shouldStop{false};
    mutable std::mutex mutex_;
};
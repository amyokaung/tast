#include "llama_bridge.h"
#include <jni.h>
#include <android/log.h>
#include <fstream>
#include <sstream>
#include <thread>
#include <chrono>

#define TAG "KhittaraLlamaBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

#if __has_include("llama.h")
    #include "llama.h"
    #define HAS_REAL_LLAMA 1
#else
    #define HAS_REAL_LLAMA 0
#endif

#if HAS_REAL_LLAMA
struct KhittaraLlamaBridge::Impl {
    llama_model* model = nullptr;
    llama_context* ctx = nullptr;
    llama_sampler* sampler = nullptr;
    std::string modelPath;
    int contextSize = 2048;
    int nThreads = 4;
};
#else
struct KhittaraLlamaBridge::Impl {
    void* model = nullptr;
    void* ctx = nullptr;
    void* sampler = nullptr;
    std::string modelPath;
    int contextSize = 2048;
    int nThreads = 4;
};
#endif

KhittaraLlamaBridge::KhittaraLlamaBridge() : pImpl(std::make_unique<Impl>()) {
#if HAS_REAL_LLAMA
    llama_backend_init();
#endif
}

KhittaraLlamaBridge::~KhittaraLlamaBridge() {
    unloadModel();
#if HAS_REAL_LLAMA
    llama_backend_free();
#endif
}

KhittaraLlamaBridge& KhittaraLlamaBridge::getInstance() {
    static KhittaraLlamaBridge instance;
    return instance;
}

bool KhittaraLlamaBridge::loadModel(const LlamaModelParams& params, std::string& outError) {
    std::lock_guard<std::mutex> lock(mutex_);
    unloadModel();

    std::ifstream file(params.modelPath, std::ios::binary);
    if (!file.is_open()) {
        outError = "Model file could not be opened: " + params.modelPath;
        return false;
    }

    char magic[4];
    file.read(magic, 4);
    if (file.gcount() < 4 || magic[0] != 'G' || magic[1] != 'G' || magic[2] != 'U' || magic[3] != 'F') {
        outError = "File is not a valid GGUF format: " + params.modelPath;
        return false;
    }
    file.close();

    pImpl->modelPath = params.modelPath;
    pImpl->contextSize = params.contextSize;
    pImpl->nThreads = params.nThreads;

#if HAS_REAL_LLAMA
    llama_model_params model_params = llama_model_default_params();
    model_params.n_gpu_layers = params.nGpuLayers;
    model_params.use_mmap = params.useMmap;
    pImpl->model = llama_model_load_from_file(params.modelPath.c_str(), model_params);
    if (!pImpl->model) {
        outError = "Failed to parse model file with llama.cpp";
        return false;
    }

    llama_context_params ctx_params = llama_context_default_params();
    ctx_params.n_ctx = params.contextSize;
    ctx_params.n_threads = params.nThreads;
    ctx_params.n_threads_batch = params.nThreads;

    pImpl->ctx = llama_init_from_model(pImpl->model, ctx_params);
    if (!pImpl->ctx) {
        llama_model_free(pImpl->model);
        pImpl->model = nullptr;
        outError = "Failed to initialize context (Out of Memory)";
        return false;
    }

    llama_sampler_chain_params sparams = llama_sampler_chain_default_params();
    pImpl->sampler = llama_sampler_chain_init(sparams);
    llama_sampler_chain_add(pImpl->sampler, llama_sampler_init_temp(0.7f));
    llama_sampler_chain_add(pImpl->sampler, llama_sampler_init_top_p(0.9f, 1));
#else
    pImpl->model = (void*)0x1;
    pImpl->ctx = (void*)0x1;
#endif

    LOGI("Model loaded: %s", params.modelPath.c_str());
    return true;
}

void KhittaraLlamaBridge::unloadModel() {
    stopInference();
#if HAS_REAL_LLAMA
    if (pImpl->sampler) { llama_sampler_free(pImpl->sampler); pImpl->sampler = nullptr; }
    if (pImpl->ctx) { llama_free(pImpl->ctx); pImpl->ctx = nullptr; }
    if (pImpl->model) { llama_model_free(pImpl->model); pImpl->model = nullptr; }
#else
    pImpl->model = nullptr;
    pImpl->ctx = nullptr;
#endif
    pImpl->modelPath = "";
}

bool KhittaraLlamaBridge::isModelLoaded() const {
    return pImpl->model != nullptr && pImpl->ctx != nullptr;
}

void KhittaraLlamaBridge::stopInference() {
    shouldStop.store(true);
}

// UTF-8 validator to prevent broken Burmese glyphs
static bool isCompleteUtf8(const std::string& str) {
    if (str.empty()) return true;
    size_t i = 0;
    while (i < str.size()) {
        unsigned char c = static_cast<unsigned char>(str[i]);
        size_t len = 0;
        if ((c & 0x80) == 0x00) len = 1;
        else if ((c & 0xE0) == 0xC0) len = 2;
        else if ((c & 0xF0) == 0xE0) len = 3; // Myanmar Unicode
        else if ((c & 0xF8) == 0xF0) len = 4;
        else return false;

        if (i + len > str.size()) return false;
        for (size_t j = 1; j < len; ++j) {
            if ((static_cast<unsigned char>(str[i + j]) & 0xC0) != 0x80) return false;
        }
        i += len;
    }
    return true;
}

bool KhittaraLlamaBridge::generateStreaming(
    const LlamaInferenceParams& params,
    TokenCallback callback,
    std::string& outError
) {
    if (!isModelLoaded()) {
        outError = "No GGUF model is loaded in memory.";
        return false;
    }

    isRunning.store(true);
    shouldStop.store(false);

#if HAS_REAL_LLAMA
    const llama_vocab* vocab = llama_model_get_vocab(pImpl->model);
    int n_prompt_tokens = -llama_tokenize(vocab, params.prompt.c_str(), params.prompt.length(), NULL, 0, true, true);
    std::vector<llama_token> prompt_tokens(n_prompt_tokens);
    llama_tokenize(vocab, params.prompt.c_str(), params.prompt.length(), prompt_tokens.data(), prompt_tokens.size(), true, true);

    llama_batch batch = llama_batch_init(params.maxTokens, 0, 1);
    for (size_t i = 0; i < prompt_tokens.size(); i++) {
        llama_batch_add(batch, prompt_tokens[i], i, { 0 }, false);
    }
    batch.logits[batch.n_tokens - 1] = true;

    if (llama_decode(pImpl->ctx, batch) != 0) {
        llama_batch_free(batch);
        isRunning.store(false);
        return false;
    }

    int tokens_generated = 0;
    std::string utf8_buffer;

    while (tokens_generated < params.maxTokens && !shouldStop.load()) {
        llama_token new_token_id = llama_sampler_sample(pImpl->sampler, pImpl->ctx, -1);
        llama_sampler_accept(pImpl->sampler, new_token_id);

        if (llama_vocab_is_eog(vocab, new_token_id)) break;

        char piece[256];
        int n_piece = llama_token_to_piece(vocab, new_token_id, piece, sizeof(piece), 0, true);
        if (n_piece > 0) {
            utf8_buffer.append(piece, n_piece);
            if (isCompleteUtf8(utf8_buffer)) {
                callback(utf8_buffer, false, ++tokens_generated);
                utf8_buffer.clear();
            }
        }

        llama_batch_clear(batch);
        llama_batch_add(batch, new_token_id, prompt_tokens.size() + tokens_generated, { 0 }, true);
        if (llama_decode(pImpl->ctx, batch) != 0) break;
    }

    if (!utf8_buffer.empty()) {
        callback(utf8_buffer, false, ++tokens_generated);
    }

    llama_batch_free(batch);
    callback("", true, tokens_generated);
#endif

    isRunning.store(false);
    return true;
}

// JNI Entry points
extern "C" {
JNIEXPORT jboolean JNICALL
Java_com_khittara_offlineai_LlamaModule_nativeLoadModel(JNIEnv* env, jobject, jstring jModelPath, jint contextSize, jint nThreads) {
    const char* path = env->GetStringUTFChars(jModelPath, nullptr);
    LlamaModelParams params{path, contextSize, nThreads};
    std::string err;
    bool ok = KhittaraLlamaBridge::getInstance().loadModel(params, err);
    env->ReleaseStringUTFChars(jModelPath, path);
    return ok ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_khittara_offlineai_LlamaModule_nativeUnloadModel(JNIEnv*, jobject) {
    KhittaraLlamaBridge::getInstance().unloadModel();
}

JNIEXPORT void JNICALL
Java_com_khittara_offlineai_LlamaModule_nativeStop(JNIEnv*, jobject) {
    KhittaraLlamaBridge::getInstance().stopInference();
}
}
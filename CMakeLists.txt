cmake_minimum_required(VERSION 3.22.1)
project(KhittaraLlamaBridge CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)

if(${ANDROID_ABI} STREQUAL "arm64-v8a")
    add_compile_definitions(GGML_USE_CPU)
    add_compile_definitions(__ARM_NEON)
    add_compile_options(-O3 -fPIC -pthread -funroll-loops)
elseif(${ANDROID_ABI} STREQUAL "x86_64")
    add_compile_definitions(GGML_USE_CPU)
    add_compile_options(-O3 -fPIC -pthread -mavx -mavx2 -mfma)
else()
    add_compile_options(-O3 -fPIC -pthread)
endif()

set(LLAMA_ROOT_DIR ${CMAKE_CURRENT_SOURCE_DIR}/cpp/llama.cpp)
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/cpp
    ${LLAMA_ROOT_DIR}/include
    ${LLAMA_ROOT_DIR}/ggml/include
)

add_library(
    khittara_llama_bridge
    SHARED
    ${CMAKE_CURRENT_SOURCE_DIR}/cpp/llama_bridge.cpp
)

find_library(log-lib log)
find_library(android-lib android)

target_link_libraries(
    khittara_llama_bridge
    PRIVATE
    ${log-lib}
    ${android-lib}
)
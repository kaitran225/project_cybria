using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace LLama.Native.Pure
{
    /// <summary>
    /// Pure C# model state: GGUF metadata + tensors needed for inference.
    /// Ported from llama.cpp model loading; supports F32/F16 LLaMA decoder.
    /// </summary>
    internal sealed class PureModelState : IDisposable
    {
        private readonly Dictionary<string, float[]> _tensors = new Dictionary<string, float[]>(StringComparer.Ordinal);
        private readonly IReadOnlyDictionary<string, object> _metadata;
        private readonly long _dataBaseOffset;
        private readonly IReadOnlyList<GgufTensorInfo> _tensorInfos;
        private bool _disposed;

        public int NEmbd => GetMetaInt32("llama.embedding_length");
        public int NLayer => GetMetaInt32("llama.block_count");
        public int NHead => GetMetaInt32("llama.attention.head_count");
        public int NHeadKv => GetMetaInt32("llama.attention.head_count_kv");
        public int NCtxTrain => GetMetaInt32("llama.context_length");
        public int VocabSize => GetMetaInt32("llama.vocab_size");
        public ulong SizeInBytes { get; private set; }
        public ulong ParameterCount { get; private set; }

        public IReadOnlyDictionary<string, string> MetadataStrings => _metadata
            .Where(kv => kv.Value is string)
            .ToDictionary(kv => kv.Key, kv => (string)kv.Value, StringComparer.Ordinal);

        private PureTokenizer? _tokenizer;
        public PureTokenizer Tokenizer => _tokenizer ??= new PureTokenizer(_metadata);

        private int GetMetaInt32(string key)
        {
            if (_metadata.TryGetValue(key, out var v))
            {
                if (v is long l) return (int)l;
                if (v is int i) return i;
                if (v is uint u) return (int)u;
            }
            throw new InvalidOperationException($"Missing GGUF metadata: {key}");
        }

        private PureModelState(
            IReadOnlyDictionary<string, object> metadata,
            long dataBaseOffset,
            IReadOnlyList<GgufTensorInfo> tensorInfos)
        {
            _metadata = metadata;
            _dataBaseOffset = dataBaseOffset;
            _tensorInfos = tensorInfos;
        }

        /// <summary>
        /// Load model from GGUF file. Reads metadata and tensor infos; tensor data is loaded on demand or when PreloadTensors is true.
        /// </summary>
        public static PureModelState Load(string modelPath, bool useMmap, LlamaProgressCallback? progress, IntPtr progressCtx)
        {
            using var fs = new FileStream(modelPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            var (_, nTensors, _, dataOffset, metadata, tensorInfos) = GgufReader.ReadMeta(fs);

            var state = new PureModelState(metadata, dataOffset, tensorInfos);
            state.LoadAllTensors(fs, progress, progressCtx);
            state.ComputeSizes();
            return state;
        }

        private void LoadAllTensors(Stream s, LlamaProgressCallback? progress, IntPtr progressCtx)
        {
            for (int i = 0; i < _tensorInfos.Count; i++)
            {
                progress?.Invoke((float)(i + 1) / _tensorInfos.Count, progressCtx);
                var info = _tensorInfos[i];
                if (info.Type != GgmlType.F32 && info.Type != GgmlType.F16 &&
                    info.Type != GgmlType.Q4_0 && info.Type != GgmlType.Q8_0)
                    continue;
                float[] data = GgufReader.ReadTensorF32(s, info, _dataBaseOffset);
                _tensors[info.Name] = data;
            }
        }

        private void ComputeSizes()
        {
            ulong bytes = 0;
            ulong params_ = 0;
            foreach (var arr in _tensors.Values)
            {
                bytes += (ulong)(arr.Length * sizeof(float));
                params_ += (ulong)arr.Length;
            }
            SizeInBytes = bytes;
            ParameterCount = params_;
        }

        public float[]? GetTensor(string name)
        {
            if (_tensors.TryGetValue(name, out var t))
                return t;
            return null;
        }

        public bool HasTensor(string name) => _tensors.ContainsKey(name);

        public void Dispose()
        {
            if (_disposed) return;
            _tensors.Clear();
            _disposed = true;
        }
    }
}

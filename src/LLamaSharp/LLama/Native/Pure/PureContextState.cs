using System;
using System.Runtime.InteropServices;

namespace LLama.Native.Pure
{
    /// <summary>
    /// Pure C# context state: holds model ref and runs decode (forward) to produce logits.
    /// </summary>
    internal sealed class PureContextState : IDisposable
    {
        private readonly PureModelState _model;
        private readonly int _nCtx;
        private readonly int _vocabSize;
        private readonly int _nEmbd;
        private float[] _logitsBuffer;
        private float[]? _workBuffer;
        private int _lastBatchTokenCount;
        private bool _disposed;

        public PureModelState Model => _model;
        public uint ContextSize => (uint)_nCtx;
        public int EmbeddingSize => _nEmbd;
        public int VocabSize => _vocabSize;

        public PureContextState(PureModelState model, uint nCtx)
        {
            _model = model ?? throw new ArgumentNullException(nameof(model));
            _nCtx = (int)Math.Min(nCtx, model.NCtxTrain);
            _vocabSize = model.VocabSize;
            _nEmbd = model.NEmbd;
            _logitsBuffer = new float[_vocabSize * 64];
            _lastBatchTokenCount = 0;
        }

        /// <summary>
        /// Decode a batch of tokens; write logits for each requested position into internal buffer.
        /// </summary>
        public int Decode(ReadOnlySpan<LLamaToken> tokens, ReadOnlySpan<LLamaPos> positions, ReadOnlySpan<byte> logitsRequested)
        {
            int nTokens = tokens.Length;
            if (nTokens <= 0) return 0;

            if (nTokens * _vocabSize > _logitsBuffer.Length)
                Array.Resize(ref _logitsBuffer, nTokens * _vocabSize);

            int needWork = LlamaForward.GetRequiredWorkBufferLength(_model, nTokens);
            if (_workBuffer == null || _workBuffer.Length < needWork)
                _workBuffer = new float[needWork];

            var tokenIds = new int[nTokens];
            for (int i = 0; i < nTokens; i++)
                tokenIds[i] = (int)tokens[i];

            LlamaForward.Forward(_model, tokenIds, _logitsBuffer, nTokens, _vocabSize, _workBuffer);
            _lastBatchTokenCount = nTokens;
            return 0;
        }

        /// <summary>
        /// Get pointer to logits for the i-th token in the last batch (0 = first, n_tokens-1 = last).
        /// Valid until next Decode.
        /// </summary>
        public unsafe float* GetLogitsIth(int i)
        {
            if (i < 0 || i >= _lastBatchTokenCount)
                return null;
            fixed (float* p = _logitsBuffer)
                return p + (i * _vocabSize);
        }

        /// <summary>Logits for the i-th token in the last batch (0-based).</summary>
        public Span<float> GetLogitsSpan(int i)
        {
            if (i < 0 || i >= _lastBatchTokenCount)
                return default;
            return new Span<float>(_logitsBuffer, i * _vocabSize, _vocabSize);
        }

        /// <summary>Span covering the last numTokens rows of logits (last row = last token). Length = numTokens * vocabSize.</summary>
        public Span<float> GetLogitsSpanLast(int numTokens)
        {
            if (numTokens <= 0 || _lastBatchTokenCount <= 0)
                return default;
            int rows = Math.Min(numTokens, _lastBatchTokenCount);
            int start = (_lastBatchTokenCount - rows) * _vocabSize;
            return new Span<float>(_logitsBuffer, start, rows * _vocabSize);
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
        }
    }
}

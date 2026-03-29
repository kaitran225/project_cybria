using System;

namespace LLama.Native.Pure
{
    /// <summary>
    /// Full LLaMA forward in pure C#: embedding -> N x (attn_norm -> Q,K,V -> RoPE -> causal attn -> residual -> ffn_norm -> FFN SiLU -> residual) -> output_norm -> lm_head.
    /// Ported from llama.cpp models/llama.cpp
    /// </summary>
    internal static class LlamaForward
    {
        private const float RmsEps = 1e-6f;

        /// <summary>Required work buffer length for Forward(model, nTokens).</summary>
        public static int GetRequiredWorkBufferLength(PureModelState model, int nTokens)
        {
            int nEmbd = model.NEmbd;
            int nHead = model.NHead;
            int nHeadKv = model.NHeadKv;
            int headDim = nEmbd / nHead;
            int nQ = nHead * headDim;
            int nK = nHeadKv * headDim;
            int ffnDim = 0;
            var ffnG = model.GetTensor("blk.0.ffn_gate.weight");
            if (ffnG != null) ffnDim = ffnG.Length / nEmbd;
            return nTokens * nEmbd * 2 + nTokens * (nQ + nK * 2) + nTokens * nHeadKv * headDim + ffnDim * 2 + nEmbd;
        }

        public static void Forward(
            PureModelState model,
            ReadOnlySpan<int> tokenIds,
            Span<float> logitsOut,
            int nTokens,
            int vocabSize,
            float[]? workBuf = null)
        {
            int nEmbd = model.NEmbd;
            int nLayer = model.NLayer;
            int nHead = model.NHead;
            int nHeadKv = model.NHeadKv;
            int headDim = nEmbd / nHead;
            float freqBase = 10000f;
            float freqScale = 1f;
            if (model.MetadataStrings.TryGetValue("llama.rope.freq_base", out var fb))
                float.TryParse(fb, out freqBase);
            if (model.MetadataStrings.TryGetValue("llama.rope.scale_linear", out var fs))
                float.TryParse(fs, out freqScale);
            float scale = 1f / (float)Math.Sqrt(headDim);

            var tokEmb = model.GetTensor("token_embd.weight") ?? model.GetTensor("tok_embeddings.weight");
            var outputNorm = model.GetTensor("output_norm.weight");
            var output = model.GetTensor("output.weight") ?? model.GetTensor("lm_head.weight");
            if (tokEmb == null || output == null)
                throw new InvalidOperationException("Pure backend: missing token_embd and output/lm_head.");

            int nQ = nHead * headDim;
            int nK = nHeadKv * headDim;
            int ffnDim = 0;
            var ffnG = model.GetTensor("blk.0.ffn_gate.weight");
            if (ffnG != null) ffnDim = ffnG.Length / nEmbd;
            int needWork = nTokens * nEmbd * 2 + nTokens * (nQ + nK * 2) + nTokens * nHeadKv * headDim + ffnDim * 2 + nEmbd;
            bool alloc = workBuf == null || workBuf.Length < needWork;
            if (alloc) workBuf = new float[needWork];

            Span<float> hidden = workBuf.AsSpan(0, nTokens * nEmbd);
            Span<float> layerIn = workBuf.AsSpan(nTokens * nEmbd, nTokens * nEmbd);
            Span<float> qkv = workBuf.AsSpan(nTokens * nEmbd * 2, nTokens * (nQ + nK * 2));

            for (int t = 0; t < nTokens; t++)
            {
                int tid = tokenIds[t];
                if (tid < 0 || tid >= vocabSize) continue;
                for (int j = 0; j < nEmbd; j++)
                    hidden[t * nEmbd + j] = tokEmb[tid * nEmbd + j];
            }

            for (int il = 0; il < nLayer; il++)
            {
                string blk = "blk." + il + ".";
                var attnNorm = model.GetTensor(blk + "attn_norm.weight");
                var wq = model.GetTensor(blk + "attn_q.weight");
                var wk = model.GetTensor(blk + "attn_k.weight");
                var wv = model.GetTensor(blk + "attn_v.weight");
                var wo = model.GetTensor(blk + "attn_output.weight");
                var ffnNorm = model.GetTensor(blk + "ffn_norm.weight");
                var ffnGate = model.GetTensor(blk + "ffn_gate.weight");
                var ffnUp = model.GetTensor(blk + "ffn_up.weight");
                var ffnDown = model.GetTensor(blk + "ffn_down.weight");

                if (attnNorm == null || wq == null || wo == null || ffnNorm == null || ffnGate == null || ffnUp == null || ffnDown == null)
                {
                    if (il == 0)
                        throw new InvalidOperationException("Pure backend: missing layer tensors (blk.N.attn_norm/attn_q/ffn_*). Use F32/F16 GGUF.");
                    break;
                }

                hidden.CopyTo(layerIn);

                for (int t = 0; t < nTokens; t++)
                {
                    var hRow = hidden.Slice(t * nEmbd, nEmbd);
                    var normOut = layerIn.Slice(t * nEmbd, nEmbd);
                    TensorOps.RmsNorm(hRow, attnNorm, normOut, RmsEps);
                }

                Span<float> q = qkv.Slice(0, nTokens * nQ);
                Span<float> k = qkv.Slice(nTokens * nQ, nTokens * nK);
                Span<float> v = qkv.Slice(nTokens * nQ + nTokens * nK, nTokens * nK);
                q.Clear(); k.Clear(); v.Clear();

                for (int t = 0; t < nTokens; t++)
                {
                    TensorOps.MatVec(wq, layerIn.Slice(t * nEmbd, nEmbd), q.Slice(t * nQ, nQ), nEmbd, nQ);
                    TensorOps.MatVec(wk, layerIn.Slice(t * nEmbd, nEmbd), k.Slice(t * nK, nK), nEmbd, nK);
                    TensorOps.MatVec(wv, layerIn.Slice(t * nEmbd, nEmbd), v.Slice(t * nK, nK), nEmbd, nK);
                }

                for (int t = 0; t < nTokens; t++)
                {
                    TensorOps.Rope(q.Slice(t * nQ, nQ), headDim, nHead, t, freqBase, freqScale);
                    TensorOps.Rope(k.Slice(t * nK, nK), headDim, nHeadKv, t, freqBase, freqScale);
                }

                Span<float> attnOut = workBuf.AsSpan(nTokens * nEmbd * 4, nTokens * nHeadKv * headDim);
                attnOut.Clear();
                TensorOps.CausalAttention(q, k, v, nTokens, nHead, headDim, nHeadKv, scale, attnOut);

                int attnOutDim = nHeadKv * headDim;
                for (int t = 0; t < nTokens; t++)
                {
                    var res = hidden.Slice(t * nEmbd, nEmbd);
                    var attnRow = attnOut.Slice(t * attnOutDim, attnOutDim);
                    var proj = workBuf.AsSpan(nTokens * nEmbd * 4, nEmbd);
                    proj.Clear();
                    TensorOps.MatVec(wo, attnRow, proj, attnOutDim, nEmbd);
                    for (int i = 0; i < nEmbd; i++)
                        hidden[t * nEmbd + i] = res[i] + proj[i];
                }

                hidden.CopyTo(layerIn);
                for (int t = 0; t < nTokens; t++)
                    TensorOps.RmsNorm(hidden.Slice(t * nEmbd, nEmbd), ffnNorm, layerIn.Slice(t * nEmbd, nEmbd), RmsEps);

                int ffnBufOff = nTokens * nEmbd * 4 + nTokens * nHeadKv * headDim;
                for (int t = 0; t < nTokens; t++)
                {
                    var inp = layerIn.Slice(t * nEmbd, nEmbd);
                    var gateRow = workBuf.AsSpan(ffnBufOff, ffnDim);
                    var upRow = workBuf.AsSpan(ffnBufOff + ffnDim, ffnDim);
                    gateRow.Clear(); upRow.Clear();
                    TensorOps.MatVec(ffnGate, inp, gateRow, nEmbd, ffnDim);
                    TensorOps.MatVec(ffnUp, inp, upRow, nEmbd, ffnDim);
                    for (int i = 0; i < ffnDim; i++)
                        gateRow[i] = TensorOps.SiLU(gateRow[i]) * upRow[i];
                    var ffnOut = workBuf.AsSpan(ffnBufOff + ffnDim * 2, nEmbd);
                    ffnOut.Clear();
                    TensorOps.MatVec(ffnDown, gateRow, ffnOut, ffnDim, nEmbd);
                    for (int i = 0; i < nEmbd; i++)
                        hidden[t * nEmbd + i] = layerIn[t * nEmbd + i] + ffnOut[i];
                }
            }

            if (outputNorm != null)
            {
                for (int t = 0; t < nTokens; t++)
                    TensorOps.RmsNorm(hidden.Slice(t * nEmbd, nEmbd), outputNorm, layerIn.Slice(t * nEmbd, nEmbd), RmsEps);
                layerIn.Slice(0, nTokens * nEmbd).CopyTo(hidden);
            }

            for (int t = 0; t < nTokens; t++)
            {
                Span<float> oneLogits = logitsOut.Slice(t * vocabSize, vocabSize);
                oneLogits.Clear();
                TensorOps.MatVec(output, hidden.Slice(t * nEmbd, nEmbd), oneLogits, nEmbd, vocabSize);
            }
        }
    }
}

using System;

namespace LLama.Native.Pure
{
    /// <summary>
    /// Pure C# tensor ops for LLaMA forward. Ported from ggml/llama.cpp.
    /// </summary>
    internal static class TensorOps
    {
        public const float DefaultRmsEps = 1e-6f;

        /// <summary>RMSNorm: out = x * rsqrt(sum(x^2)/n + eps) * weight</summary>
        public static void RmsNorm(ReadOnlySpan<float> x, ReadOnlySpan<float> weight, Span<float> output, float eps = DefaultRmsEps)
        {
            int n = x.Length;
            float sum = 0;
            for (int i = 0; i < n; i++)
                sum += x[i] * x[i];
            float scale = (float)(1.0 / Math.Sqrt(sum / n + eps));
            for (int i = 0; i < n; i++)
                output[i] = x[i] * scale * weight[i];
        }

        /// <summary>outAdd[j] += sum_i vec[i] * mat[i*cols + j]. mat is [rows, cols], vec length rows, outAdd length cols.</summary>
        public static void MatVec(ReadOnlySpan<float> mat, ReadOnlySpan<float> vec, Span<float> outAdd, int rows, int cols)
        {
            for (int j = 0; j < cols; j++)
            {
                float s = 0;
                for (int i = 0; i < rows; i++)
                    s += mat[i * cols + j] * vec[i];
                outAdd[j] += s;
            }
        }

        /// <summary>SiLU (swish): x * sigmoid(x)</summary>
        public static float SiLU(float x)
        {
            return x * (1f / (1f + (float)Math.Exp(-x)));
        }

        /// <summary>RoPE in-place. q is one token's Q [nHeads*headDim]; layout h,d = q[h*headDim+d].</summary>
        public static void Rope(Span<float> q, int headDim, int nHeads, int pos, float freqBase, float freqScale)
        {
            for (int h = 0; h < nHeads; h++)
            {
                int off = h * headDim;
                for (int i = 0; i < headDim; i += 2)
                {
                    float theta = pos * (float)Math.Pow(freqBase, -i / (float)headDim) * freqScale;
                    float c = (float)Math.Cos(theta);
                    float s = (float)Math.Sin(theta);
                    float q0 = q[off + i];
                    float q1 = q[off + i + 1];
                    q[off + i] = q0 * c - q1 * s;
                    q[off + i + 1] = q0 * s + q1 * c;
                }
            }
        }

        /// <summary>Causal attention. Q,K,V layout [nTokens, nHeads, headDim] flat as t*(nHeads*headDim)+h*headDim+d. K,V use nHeadKv. out = attention output [nTokens, nHeadKv*headDim].</summary>
        public static void CausalAttention(
            ReadOnlySpan<float> q, ReadOnlySpan<float> k, ReadOnlySpan<float> v,
            int nTokens, int nHeads, int headDim, int nHeadKv, float scale,
            Span<float> output)
        {
            int qStride = nHeads * headDim;
            int kvStride = nHeadKv * headDim;
            output.Clear();

            for (int t = 0; t < nTokens; t++)
            {
                int qOff = t * qStride;
                for (int h = 0; h < nHeadKv; h++)
                {
                    int outOff = t * kvStride + h * headDim;
                    float maxScore = float.NegativeInfinity;
                    for (int s = 0; s <= t; s++)
                    {
                        float score = 0;
                        int kOff = s * kvStride + h * headDim;
                        int qh = h < nHeads ? h : 0;
                        for (int d = 0; d < headDim; d++)
                            score += q[qOff + qh * headDim + d] * k[kOff + d];
                        if (score > maxScore) maxScore = score;
                    }
                    float sumExp = 0;
                    for (int s = 0; s <= t; s++)
                    {
                        float score = 0;
                        int kOff = s * kvStride + h * headDim;
                        int qh = h < nHeads ? h : 0;
                        for (int d = 0; d < headDim; d++)
                            score += q[qOff + qh * headDim + d] * k[kOff + d];
                        sumExp += (float)Math.Exp(score * scale - maxScore);
                    }
                    float invSum = sumExp > 0 ? (float)Math.Exp(-maxScore) / sumExp : 0;
                    for (int d = 0; d < headDim; d++)
                        output[outOff + d] = 0;
                    for (int s = 0; s <= t; s++)
                    {
                        float score = 0;
                        int kOff = s * kvStride + h * headDim;
                        int vOff = s * kvStride + h * headDim;
                        int qh = h < nHeads ? h : 0;
                        for (int d = 0; d < headDim; d++)
                            score += q[qOff + qh * headDim + d] * k[kOff + d];
                        float attn = (float)Math.Exp(score * scale - maxScore) * invSum;
                        for (int d = 0; d < headDim; d++)
                            output[outOff + d] += attn * v[vOff + d];
                    }
                }
            }
        }
    }
}

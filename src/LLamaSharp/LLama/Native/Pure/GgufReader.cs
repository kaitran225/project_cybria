using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace LLama.Native.Pure
{
    /// <summary>
    /// GGUF type codes (matches gguf_type in gguf.h).
    /// </summary>
    internal enum GgufValueType : int
    {
        U8 = 0, I8 = 1, U16 = 2, I16 = 3, U32 = 4, I32 = 5,
        F32 = 6, Bool = 7, String = 8, Array = 9, U64 = 10, I64 = 11, F64 = 12,
    }

    /// <summary>
    /// GGML tensor type (subset used for reading).
    /// </summary>
    internal enum GgmlType : int
    {
        F32 = 0,
        F16 = 1,
        Q4_0 = 2, Q4_1 = 3, Q5_0 = 6, Q5_1 = 7, Q8_0 = 8, Q8_1 = 9,
    }

    internal readonly struct GgufTensorInfo
    {
        public string Name { get; }
        public int[] Dims { get; }
        public GgmlType Type { get; }
        public ulong FileOffset { get; }

        public GgufTensorInfo(string name, int[] dims, GgmlType type, ulong fileOffset)
        {
            Name = name;
            Dims = dims;
            Type = type;
            FileOffset = fileOffset;
        }

        public long ElementCount
        {
            get
            {
                long n = 1;
                for (int i = 0; i < Dims.Length; i++)
                    n *= Dims[i];
                return n;
            }
        }

        public static int TypeSize(GgmlType t)
        {
            return t switch
            {
                GgmlType.F32 => 4,
                GgmlType.F16 => 2,
                GgmlType.Q4_0 => 2 + 16,
                GgmlType.Q8_0 => 2 + 32,
                _ => throw new NotSupportedException($"GGML type {t} not supported in pure C# backend.")
            };
        }

        public static int BlockSize(GgmlType t)
        {
            return t switch
            {
                GgmlType.Q4_0 => 32,
                GgmlType.Q8_0 => 32,
                _ => 1
            };
        }

        public long ByteSize => ElementCount * TypeSize(Type);
        public int ElementSize => TypeSize(Type);
    }

    /// <summary>
    /// Pure C# GGUF file reader. Reads header, metadata (KV), and tensor infos + data.
    /// Ported from llama.cpp gguf.h / GGUF layout. Supports F32 and F16 tensors for inference.
    /// </summary>
    internal static class GgufReader
    {
        public const uint SupportedVersion = 3;
        private const int DefaultAlignment = 32;

        public static (uint version, long nTensors, long nKv, long dataOffset, IReadOnlyDictionary<string, object> metadata, IReadOnlyList<GgufTensorInfo> tensors) ReadMeta(Stream s)
        {
            var br = new BinaryReader(s, Encoding.UTF8, leaveOpen: true);
            var magic = br.ReadBytes(4);
            if (Encoding.ASCII.GetString(magic) != "GGUF")
                throw new InvalidOperationException("Invalid GGUF magic.");

            uint version = br.ReadUInt32();
            if (version > SupportedVersion)
                throw new InvalidOperationException($"Unsupported GGUF version {version}.");

            long nTensors = br.ReadInt64();
            long nKv = br.ReadInt64();

            uint alignment = DefaultAlignment;
            var metadata = new Dictionary<string, object>(StringComparer.Ordinal);

            for (long k = 0; k < nKv; k++)
            {
                string key = ReadString(br);
                var vt = (GgufValueType)br.ReadInt32();
                object val = ReadValue(br, vt);
                metadata[key] = val;
                if (key == "general.alignment" && val is long al)
                    alignment = (uint)al;
            }

            var tensorInfos = new List<GgufTensorInfo>();
            long dataOffset = s.Position;

            for (long t = 0; t < nTensors; t++)
            {
                string name = ReadString(br);
                int nDims = (int)br.ReadUInt32();
                var dims = new int[nDims];
                for (int d = 0; d < nDims; d++)
                    dims[d] = (int)br.ReadInt64();
                var type = (GgmlType)br.ReadInt32();
                ulong fileOffset = br.ReadUInt64();
                tensorInfos.Add(new GgufTensorInfo(name, dims, type, fileOffset));
            }

            dataOffset = Align(s.Position, alignment);
            return (version, nTensors, nKv, dataOffset, metadata, tensorInfos);
        }

        private static string ReadString(BinaryReader br)
        {
            ulong len = br.ReadUInt64();
            if (len > int.MaxValue)
                throw new InvalidOperationException("GGUF string too long.");
            byte[] buf = br.ReadBytes((int)len);
            return Encoding.UTF8.GetString(buf);
        }

        private static object ReadValue(BinaryReader br, GgufValueType vt)
        {
            switch (vt)
            {
                case GgufValueType.U8: return br.ReadByte();
                case GgufValueType.I8: return br.ReadSByte();
                case GgufValueType.U16: return br.ReadUInt16();
                case GgufValueType.I16: return br.ReadInt16();
                case GgufValueType.U32: return br.ReadUInt32();
                case GgufValueType.I32: return br.ReadInt32();
                case GgufValueType.F32: return br.ReadSingle();
                case GgufValueType.Bool: return br.ReadSByte() != 0;
                case GgufValueType.String: return ReadString(br);
                case GgufValueType.U64: return br.ReadUInt64();
                case GgufValueType.I64: return br.ReadInt64();
                case GgufValueType.F64: return br.ReadDouble();
                case GgufValueType.Array:
                    var arrType = (GgufValueType)br.ReadInt32();
                    ulong n = br.ReadUInt64();
                    var list = new List<object>();
                    for (ulong i = 0; i < n; i++)
                        list.Add(ReadValue(br, arrType));
                    return list;
                default:
                    throw new NotSupportedException($"GGUF value type {vt} not supported.");
            }
        }

        private static long Align(long pos, uint alignment)
        {
            if (alignment == 0) return pos;
            return (pos + alignment - 1) / alignment * alignment;
        }

        /// <summary>
        /// Read a single tensor's data as float[] (F32 or F16 -> F32).
        /// </summary>
        public static float[] ReadTensorF32(Stream s, in GgufTensorInfo info, long dataBaseOffset)
        {
            long count = info.ElementCount;
            if (count <= 0 || count > int.MaxValue)
                throw new InvalidOperationException($"Invalid tensor size: {info.Name}");
            var arr = new float[count];
            long offset = dataBaseOffset + (long)info.FileOffset;
            s.Seek(offset, SeekOrigin.Begin);
            if (info.Type == GgmlType.F32)
            {
                var bytes = new byte[count * 4];
                if (s.Read(bytes, 0, bytes.Length) != bytes.Length)
                    throw new EndOfStreamException();
                for (int i = 0; i < count; i++)
                    arr[i] = BinaryPrimitives.ReadSingleLittleEndian(bytes.AsSpan(i * 4, 4));
            }
            else if (info.Type == GgmlType.F16)
            {
                for (int i = 0; i < count; i++)
                {
                    byte b0 = (byte)s.ReadByte();
                    byte b1 = (byte)s.ReadByte();
                    ushort u = (ushort)(b0 | (b1 << 8));
                    arr[i] = HalfToFloat(u);
                }
            }
            else if (info.Type == GgmlType.Q4_0)
            {
                return ReadTensorQ4_0Dequant(s, info, dataBaseOffset);
            }
            else if (info.Type == GgmlType.Q8_0)
            {
                return ReadTensorQ8_0Dequant(s, info, dataBaseOffset);
            }
            else
                throw new NotSupportedException($"Tensor {info.Name} type {info.Type} not supported in pure backend.");
            return arr;
        }

        private const int QK4_0 = 32;
        private static float[] ReadTensorQ4_0Dequant(Stream s, in GgufTensorInfo info, long dataBaseOffset)
        {
            long count = info.ElementCount;
            int nb = (int)(count / QK4_0);
            var arr = new float[count];
            long offset = dataBaseOffset + (long)info.FileOffset;
            s.Seek(offset, SeekOrigin.Begin);
            var block = new byte[18];
            for (int i = 0; i < nb; i++)
            {
                if (s.Read(block, 0, 18) != 18) throw new EndOfStreamException();
                float d = HalfToFloat((ushort)(block[0] | (block[1] << 8)));
                for (int j = 0; j < 16; j++)
                {
                    byte q = block[2 + j];
                    int x0 = (q & 0x0F) - 8;
                    int x1 = (q >> 4) - 8;
                    arr[i * QK4_0 + j] = x0 * d;
                    arr[i * QK4_0 + j + 16] = x1 * d;
                }
            }
            return arr;
        }

        private const int QK8_0 = 32;
        private static float[] ReadTensorQ8_0Dequant(Stream s, in GgufTensorInfo info, long dataBaseOffset)
        {
            long count = info.ElementCount;
            int nb = (int)(count / QK8_0);
            var arr = new float[count];
            long offset = dataBaseOffset + (long)info.FileOffset;
            s.Seek(offset, SeekOrigin.Begin);
            var block = new byte[34];
            for (int i = 0; i < nb; i++)
            {
                if (s.Read(block, 0, 34) != 34) throw new EndOfStreamException();
                float d = HalfToFloat((ushort)(block[0] | (block[1] << 8)));
                for (int j = 0; j < QK8_0; j++)
                    arr[i * QK8_0 + j] = (sbyte)block[2 + j] * d;
            }
            return arr;
        }

        private static float HalfToFloat(ushort h)
        {
            int sign = (h >> 15) & 1;
            int exp = (h >> 10) & 0x1F;
            int mant = h & 0x3FF;
            if (exp == 0)
                return (sign == 1 ? -1f : 1f) * (mant / 1024f) * (float)Math.Pow(2, -14);
            if (exp == 0x1F)
                return mant == 0 ? (sign == 1 ? float.NegativeInfinity : float.PositiveInfinity) : float.NaN;
            float v = 1f + mant / 1024f;
            return (sign == 1 ? -1f : 1f) * v * (float)Math.Pow(2, exp - 15);
        }
    }
}

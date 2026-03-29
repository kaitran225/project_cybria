using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace LLama.Native.Pure
{
    /// <summary>
    /// Pure C# tokenizer using GGUF vocab (tokenizer.ggml.tokens + tokenizer.ggml.merges). Simple BPE encode/decode.
    /// </summary>
    internal sealed class PureTokenizer
    {
        private readonly List<byte[]> _tokenBytes;
        private readonly Dictionary<string, int> _tokenToId;
        private readonly List<string> _merges;
        private readonly int _bosId;
        private readonly int _eosId;

        public int VocabSize => _tokenBytes.Count;
        public int BosId => _bosId;
        public int EosId => _eosId;

        public PureTokenizer(IReadOnlyDictionary<string, object> metadata)
        {
            if (!metadata.TryGetValue("tokenizer.ggml.tokens", out var tokObj) || tokObj is not List<object> tokList)
            {
                _tokenBytes = new List<byte[]>();
                _tokenToId = new Dictionary<string, int>();
                _merges = new List<string>();
                _bosId = -1;
                _eosId = -1;
                return;
            }

            _tokenBytes = new List<byte[]>(tokList.Count);
            _tokenToId = new Dictionary<string, int>(tokList.Count, StringComparer.Ordinal);
            for (int i = 0; i < tokList.Count; i++)
            {
                var s = tokList[i]?.ToString() ?? "";
                var bytes = Encoding.UTF8.GetBytes(s);
                _tokenBytes.Add(bytes);
                var key = BytesToKey(bytes);
                if (!_tokenToId.ContainsKey(key))
                    _tokenToId[key] = i;
            }

            _merges = new List<string>();
            if (metadata.TryGetValue("tokenizer.ggml.merges", out var mergeObj) && mergeObj is List<object> mergeList)
            {
                foreach (var m in mergeList)
                    _merges.Add(m?.ToString() ?? "");
            }

            _bosId = GetSpecialId(metadata, "tokenizer.ggml.bos_token_id", "tokenizer.ggml.add_bos_token", "<s>", 1);
            _eosId = GetSpecialId(metadata, "tokenizer.ggml.eos_token_id", null, "</s>", 2);
        }

        private static int GetSpecialId(IReadOnlyDictionary<string, object> metadata, string idKey, string? addKey, string defaultStr, int defaultIdx)
        {
            if (metadata.TryGetValue(idKey, out var v))
            {
                if (v is long l) return (int)l;
                if (v is int i) return i;
            }
            if (addKey != null && metadata.TryGetValue(addKey, out var add) && add is bool b && !b)
                return -1;
            return defaultIdx;
        }

        private static string BytesToKey(byte[] b)
        {
            var sb = new StringBuilder(b.Length * 2);
            foreach (var x in b)
                sb.Append(x.ToString("X2"));
            return sb.ToString();
        }

        /// <summary>Encode text to token IDs. addBos: prepend BOS; special: allow special tokens.</summary>
        public int[] Encode(string text, bool addBos, bool special, Encoding encoding)
        {
            if (string.IsNullOrEmpty(text) && !addBos)
                return Array.Empty<int>();

            var bytes = encoding.GetBytes(text ?? "");
            var ids = new List<int>();
            if (addBos && _bosId >= 0)
                ids.Add(_bosId);

            if (_merges.Count == 0)
            {
                for (int i = 0; i < bytes.Length; i++)
                {
                    var single = new byte[] { bytes[i] };
                    var key = BytesToKey(single);
                    if (_tokenToId.TryGetValue(key, out int id))
                        ids.Add(id);
                    else
                        ids.Add(0);
                }
                return ids.ToArray();
            }

            var tokens = new List<byte[]>();
            foreach (var b in bytes)
                tokens.Add(new byte[] { b });

            while (true)
            {
                int bestIdx = -1;
                int bestRank = int.MaxValue;
                for (int i = 0; i < tokens.Count - 1; i++)
                {
                    var pair = Encoding.UTF8.GetString(tokens[i]) + " " + Encoding.UTF8.GetString(tokens[i + 1]);
                    int r = _merges.IndexOf(pair);
                    if (r >= 0 && r < bestRank)
                    {
                        bestRank = r;
                        bestIdx = i;
                    }
                }
                if (bestIdx < 0) break;
                var merged = new List<byte>(tokens[bestIdx]);
                merged.AddRange(tokens[bestIdx + 1]);
                tokens.RemoveRange(bestIdx, 2);
                tokens.Insert(bestIdx, merged.ToArray());
            }

            foreach (var t in tokens)
            {
                var key = BytesToKey(t);
                if (_tokenToId.TryGetValue(key, out int id))
                    ids.Add(id);
                else
                    ids.Add(0);
            }
            return ids.ToArray();
        }

        /// <summary>Decode token ID to UTF-8 bytes. lstrip: skip leading spaces; special: show special tokens.</summary>
        public int TokenToPiece(int tokenId, Span<byte> buffer, int lstrip, bool special)
        {
            if (tokenId < 0 || tokenId >= _tokenBytes.Count)
                return 0;
            var piece = _tokenBytes[tokenId];
            int skip = 0;
            if (lstrip > 0)
            {
                while (skip < piece.Length && piece[skip] == (byte)' ')
                    skip++;
                if (skip > lstrip) skip = lstrip;
            }
            int len = piece.Length - skip;
            if (len <= 0) return 0;
            if (len > buffer.Length) return -len;
            for (int i = 0; i < len; i++)
                buffer[i] = piece[skip + i];
            return len;
        }
    }
}

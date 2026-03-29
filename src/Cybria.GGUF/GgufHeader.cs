using System.Buffers.Binary;
using System.Text;

namespace Cybria.GGUF;

/// <summary>
/// Minimal GGUF file header (magic + version + n_key_values).
/// Ported from Ollama Go fs/gguf/gguf.go. Use to validate/inspect GGUF files without loading native llama.cpp.
/// </summary>
public readonly struct GgufHeader
{
    public const string ExpectedMagic = "GGUF";
    public const uint MinSupportedVersion = 2;

    public string Magic { get; }
    public uint Version { get; }
    /// <summary>Number of tensors (first count in GGUF after version).</summary>
    public ulong TensorCount { get; }
    /// <summary>Not read in minimal header (would require skipping tensor block).</summary>
    public ulong KeyValueCount { get; }

    public GgufHeader(string magic, uint version, ulong tensorCount, ulong keyValueCount = 0)
    {
        Magic = magic;
        Version = version;
        TensorCount = tensorCount;
        KeyValueCount = keyValueCount;
    }

    public bool IsValid => Magic == ExpectedMagic && Version >= MinSupportedVersion;
}

/// <summary>
/// Reads only the GGUF header (magic, version, n_key_values, n_tensors). Pure C#, no native deps.
/// </summary>
public static class GgufHeaderReader
{
    /// <summary>Read header from stream. Stream position advances past the header fields read.</summary>
    /// <exception cref="InvalidOperationException">Invalid magic or unsupported version.</exception>
    public static GgufHeader Read(Stream stream)
    {
        Span<byte> magic = stackalloc byte[4];
        if (stream.Read(magic) != 4)
            throw new InvalidOperationException("GGUF: stream too short for magic.");
        var magicStr = Encoding.ASCII.GetString(magic);
        if (!magicStr.SequenceEqual("GGUF"))
            throw new InvalidOperationException($"GGUF: invalid magic '{magicStr}'.");

        Span<byte> versionBytes = stackalloc byte[4];
        if (stream.Read(versionBytes) != 4)
            throw new InvalidOperationException("GGUF: stream too short for version.");
        var version = BinaryPrimitives.ReadUInt32LittleEndian(versionBytes);
        if (version < GgufHeader.MinSupportedVersion)
            throw new InvalidOperationException($"GGUF: unsupported version {version}.");

        Span<byte> countBytes = stackalloc byte[8];
        if (stream.Read(countBytes) != 8)
            throw new InvalidOperationException("GGUF: stream too short for n_tensors.");
        var nTensors = BinaryPrimitives.ReadUInt64LittleEndian(countBytes);

        return new GgufHeader(magicStr, version, nTensors, keyValueCount: 0);
    }

    /// <summary>Read header from file path.</summary>
    public static GgufHeader Read(string path)
    {
        using var fs = File.OpenRead(path);
        return Read(fs);
    }

    /// <summary>Try read header; returns false if file is too short or invalid.</summary>
    public static bool TryRead(Stream stream, out GgufHeader header)
    {
        header = default;
        try
        {
            header = Read(stream);
            return header.IsValid;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Try read header from file path.</summary>
    public static bool TryRead(string path, out GgufHeader header)
    {
        header = default;
        if (!File.Exists(path))
            return false;
        try
        {
            using var fs = File.OpenRead(path);
            header = Read(fs);
            return header.IsValid;
        }
        catch
        {
            return false;
        }
    }
}

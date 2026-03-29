using System.Buffers.Binary;
using System.Text;
using Cybria.GGUF;
using Xunit;

namespace Cybria.GGUF.Tests;

public class GgufHeaderReaderTests
{
    [Fact]
    public void Read_valid_header_from_stream()
    {
        using var ms = new MemoryStream();
        ms.Write(Encoding.ASCII.GetBytes("GGUF"), 0, 4);
        var versionBytes = new byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(versionBytes, 3);
        ms.Write(versionBytes, 0, 4);
        var countBytes = new byte[8];
        BinaryPrimitives.WriteUInt64LittleEndian(countBytes, 42);
        ms.Write(countBytes, 0, 8);
        ms.Position = 0;

        var header = GgufHeaderReader.Read(ms);

        Assert.Equal("GGUF", header.Magic);
        Assert.Equal(3u, header.Version);
        Assert.Equal(42ul, header.TensorCount);
        Assert.True(header.IsValid);
    }

    [Fact]
    public void Read_rejects_bad_magic()
    {
        using var ms = new MemoryStream();
        ms.Write(Encoding.ASCII.GetBytes("XXXX"), 0, 4);
        ms.Write(new byte[] { 3, 0, 0, 0 }, 0, 4);
        ms.Write(new byte[8], 0, 8);
        ms.Position = 0;

        Assert.Throws<InvalidOperationException>(() => GgufHeaderReader.Read(ms));
    }

    [Fact]
    public void Read_rejects_version_1()
    {
        using var ms = new MemoryStream();
        ms.Write(Encoding.ASCII.GetBytes("GGUF"), 0, 4);
        var versionBytes = new byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(versionBytes, 1);
        ms.Write(versionBytes, 0, 4);
        ms.Write(new byte[8], 0, 8);
        ms.Position = 0;

        Assert.Throws<InvalidOperationException>(() => GgufHeaderReader.Read(ms));
    }

    [Fact]
    public void TryRead_returns_false_for_short_stream()
    {
        using var ms = new MemoryStream(new byte[] { (byte)'G', (byte)'G' });
        var ok = GgufHeaderReader.TryRead(ms, out var header);
        Assert.False(ok);
    }
}

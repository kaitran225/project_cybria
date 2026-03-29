namespace Cybria.GGUF;

/// <summary>GGUF metadata value types (ported from Go fs/gguf gguf.go).</summary>
public enum GgufValueType : uint
{
    Uint8 = 0,
    Int8,
    Uint16,
    Int16,
    Uint32,
    Int32,
    Float32,
    Bool,
    String,
    Array,
    Uint64,
    Int64,
    Float64,
}

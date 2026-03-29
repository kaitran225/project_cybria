namespace Cybria.Modelfile;

/// <summary>
/// Thrown when Modelfile parsing fails or required FROM is missing.
/// Maps from Go parser.ParserError and errMissingFrom.
/// </summary>
public sealed class ModelfileParserException : Exception
{
    public int LineNumber { get; }

    public ModelfileParserException(string message, int lineNumber = 0)
        : base(lineNumber > 0 ? $"(line {lineNumber}): {message}" : message)
    {
        LineNumber = lineNumber;
    }

    public ModelfileParserException(string message, Exception inner)
        : base(message, inner)
    {
        LineNumber = 0;
    }
}

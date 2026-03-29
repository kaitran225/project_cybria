using System.Text;

namespace Cybria.Modelfile;

/// <summary>
/// Parsed Modelfile: list of commands (FROM, SYSTEM, PARAMETER, etc.).
/// Maps from Go parser.Modelfile.
/// </summary>
public sealed class Modelfile
{
    public List<ModelfileCommand> Commands { get; } = new();

    public string ToModelfileString()
    {
        var sb = new StringBuilder();
        foreach (var cmd in Commands)
            sb.AppendLine(ToModelfileString(cmd));
        return sb.ToString();
    }

    private static string ToModelfileString(ModelfileCommand c)
    {
        return c.Name switch
        {
            "model" => "FROM " + Quote(c.Args),
            "license" or "template" or "system" or "adapter" or "renderer" or "parser" or "requires"
                => c.Name.ToUpperInvariant() + " " + Quote(c.Args),
            "message" => MessageToString(c.Args),
            _ => "PARAMETER " + c.Name + " " + Quote(c.Args)
        };
    }

    private static string MessageToString(string args)
    {
        var i = args.IndexOf(": ", StringComparison.Ordinal);
        if (i < 0) return "MESSAGE " + Quote(args);
        var role = args[..i];
        var message = args[(i + 2)..];
        return "MESSAGE " + role + " " + Quote(message);
    }

    private static string Quote(string s)
    {
        if (s.Contains('\n') || s.StartsWith(' ') || s.EndsWith(' '))
        {
            if (s.Contains('"')) return "\"\"\"" + s + "\"\"\"";
            return "\"" + s + "\"";
        }
        return s;
    }
}

using System.Text;

namespace Cybria.Modelfile;

/// <summary>
/// Parses Modelfile content (file or string) into a <see cref="Modelfile"/>.
/// Port of Go parser.ParseFile and state machine.
/// </summary>
public static class ModelfileParser
{
    private enum State
    {
        Nil,
        Name,
        Value,
        Parameter,
        Message,
        Comment
    }

    private const string ErrMissingFrom = "no FROM line";
    private const string ErrInvalidMessageRole = "message role must be one of \"system\", \"user\", or \"assistant\"";
    private const string ErrInvalidCommand = "command must be one of \"from\", \"license\", \"template\", \"system\", \"adapter\", \"renderer\", \"parser\", \"parameter\", \"message\", or \"requires\"";

    /// <summary>Parse Modelfile from a text reader.</summary>
    /// <exception cref="ModelfileParserException">Parse error or missing FROM.</exception>
    public static Modelfile Parse(TextReader reader)
    {
        var content = reader.ReadToEnd();
        return Parse(content);
    }

    /// <summary>Parse Modelfile from string content.</summary>
    /// <exception cref="ModelfileParserException">Parse error or missing FROM.</exception>
    public static Modelfile Parse(string content)
    {
        var modelfile = new Modelfile();
        var cmd = new ModelfileCommand();
        var curr = State.Nil;
        var currLine = 1;
        var b = new StringBuilder();
        var role = "";

        foreach (var (r, isNewline) in EnumerateRunesWithNewline(content))
        {
            if (isNewline)
                currLine++;

            var (next, runeToWrite, err) = ParseRuneForState(r, curr);
            if (err != null)
            {
                if (err == "unexpected eof")
                    throw new ModelfileParserException(err + ": " + b, currLine);
                throw new ModelfileParserException(err, currLine);
            }

            if (next != curr)
            {
                switch (curr)
                {
                    case State.Name:
                        if (!IsValidCommand(b.ToString()))
                            throw new ModelfileParserException(ErrInvalidCommand, currLine);
                        var s = b.ToString().ToLowerInvariant();
                        switch (s)
                        {
                            case "from":
                                cmd.Name = "model";
                                break;
                            case "parameter":
                                next = State.Parameter;
                                goto default;
                            case "message":
                                next = State.Message;
                                goto default;
                            default:
                                cmd.Name = s;
                                break;
                        }
                        break;
                    case State.Parameter:
                        cmd.Name = b.ToString();
                        break;
                    case State.Message:
                        if (!IsValidMessageRole(b.ToString()))
                            throw new ModelfileParserException(ErrInvalidMessageRole, currLine);
                        role = b.ToString();
                        break;
                    case State.Comment:
                    case State.Nil:
                        break;
                    case State.Value:
                        var trimmed = b.ToString().TrimEnd();
                        var (unquoted, ok) = Unquote(trimmed);
                        if (!ok || IsSpace(r))
                        {
                            b.Append(r);
                            continue;
                        }
                        if (!string.IsNullOrEmpty(role))
                        {
                            unquoted = role + ": " + unquoted;
                            role = "";
                        }
                        cmd.Args = unquoted;
                        modelfile.Commands.Add(new ModelfileCommand(cmd.Name, cmd.Args));
                        cmd = new ModelfileCommand();
                        break;
                }

                b.Clear();
                curr = next;
            }

            if (runeToWrite.HasValue)
                b.Append(runeToWrite.Value);
        }

        // Flush buffer
        switch (curr)
        {
            case State.Comment:
            case State.Nil:
                break;
            case State.Value:
                var trimEnd = b.ToString().TrimEnd();
                var (unq, ok) = Unquote(trimEnd);
                if (!ok)
                    throw new ModelfileParserException("unexpected eof", currLine);
                if (!string.IsNullOrEmpty(role))
                    unq = role + ": " + unq;
                cmd.Args = unq;
                modelfile.Commands.Add(new ModelfileCommand(cmd.Name, cmd.Args));
                break;
            default:
                throw new ModelfileParserException("unexpected eof", currLine);
        }

        if (!modelfile.Commands.Any(c => c.Name == "model"))
            throw new ModelfileParserException(ErrMissingFrom, currLine);

        return modelfile;
    }

    /// <summary>Returns (nextState, rune to add to buffer or null, errorMessage).</summary>
    private static (State next, Rune? runeToWrite, string? err) ParseRuneForState(Rune r, State cs)
    {
        var ch = r.Value;
        switch (cs)
        {
            case State.Nil:
                if (ch == '#') return (State.Comment, null, null);
                if (IsSpace(r) || IsNewline(r)) return (State.Nil, null, null);
                return (State.Name, r, null);
            case State.Name:
                if (IsAlpha(r)) return (State.Name, r, null);
                if (IsSpace(r)) return (State.Value, null, null);
                return (State.Nil, null, ErrInvalidCommand);
            case State.Value:
                if (IsNewline(r)) return (State.Nil, null, null);
                if (IsSpace(r)) return (State.Nil, null, null);
                return (State.Value, r, null);
            case State.Parameter:
                if (IsAlpha(r) || IsNumber(r) || ch == '_') return (State.Parameter, r, null);
                if (IsSpace(r)) return (State.Value, null, null);
                return (State.Nil, null, "unexpected eof");
            case State.Message:
                if (IsAlpha(r)) return (State.Message, r, null);
                if (IsSpace(r)) return (State.Value, null, null);
                return (State.Nil, null, "unexpected eof");
            case State.Comment:
                if (IsNewline(r)) return (State.Nil, null, null);
                return (State.Comment, null, null);
            default:
                return (State.Nil, null, "");
        }
    }

    private static IEnumerable<(Rune r, bool isNewline)> EnumerateRunesWithNewline(string s)
    {
        foreach (var rune in s.EnumerateRunes())
        {
            var isNewline = IsNewline(rune);
            yield return (rune, isNewline);
        }
    }

    /// <summary>Unquote "..." or """...""". Returns (unquoted, true) or (original, true) if no quotes.</summary>
    public static (string result, bool ok) Unquote(string s)
    {
        if (s.Length >= 3 && s.StartsWith("\"\"\"", StringComparison.Ordinal))
        {
            if (s.Length >= 6 && s.EndsWith("\"\"\"", StringComparison.Ordinal))
                return (s[3..^3], true);
            return ("", false);
        }
        if (s.Length >= 1 && s[0] == '"')
        {
            if (s.Length >= 2 && s[^1] == '"')
                return (s[1..^1], true);
            return ("", false);
        }
        return (s, true);
    }

    public static bool IsAlpha(Rune r)
    {
        var v = r.Value;
        return (v >= 'a' && v <= 'z') || (v >= 'A' && v <= 'Z');
    }

    public static bool IsNumber(Rune r) => r.Value >= '0' && r.Value <= '9';

    public static bool IsSpace(Rune r)
    {
        var v = r.Value;
        return v == ' ' || v == '\t';
    }

    public static bool IsNewline(Rune r)
    {
        var v = r.Value;
        return v == '\r' || v == '\n';
    }

    public static bool IsValidMessageRole(string role) =>
        role == "system" || role == "user" || role == "assistant";

    public static bool IsValidCommand(string cmd)
    {
        return cmd.ToLowerInvariant() switch
        {
            "from" or "license" or "template" or "system" or "adapter" or "renderer" or "parser" or "parameter" or "message" or "requires" => true,
            _ => false
        };
    }
}

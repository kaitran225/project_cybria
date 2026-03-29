namespace Cybria.Modelfile;

/// <summary>
/// A single command from a Modelfile (e.g. FROM, SYSTEM, PARAMETER).
/// Maps from Go parser.Command.
/// </summary>
public sealed class ModelfileCommand
{
    public string Name { get; set; } = string.Empty;
    public string Args { get; set; } = string.Empty;

    public ModelfileCommand() { }

    public ModelfileCommand(string name, string args)
    {
        Name = name;
        Args = args;
    }
}

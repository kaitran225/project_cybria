namespace Cybria.Modelfile;

/// <summary>
/// Configuration extracted from a Modelfile (template, system prompt, parameters).
/// Maps from Go x/create/client.ModelfileConfig.
/// </summary>
public sealed class ModelfileConfig
{
    public string Template { get; set; } = string.Empty;
    public string System { get; set; } = string.Empty;
    public string License { get; set; } = string.Empty;
    public string Parser { get; set; } = string.Empty;
    public string Renderer { get; set; } = string.Empty;

    /// <summary>
    /// Parameter key -> value (string, float, int, or bool). Option A: store as string; Option B: typed.
    /// </summary>
    public Dictionary<string, object> Parameters { get; set; } = new();
}

using System.Text.Json;

namespace Cybria.Modelfile;

/// <summary>
/// Compile flow: parse Modelfile → extract config → optional preset export.
/// Wire point for "Add model from Modelfile" when Cybria.Desktop exists.
/// </summary>
public static class ModelfileCompile
{
    /// <summary>Parse Modelfile content and extract config. Does not resolve FROM path or save files.</summary>
    public static (string modelDir, ModelfileConfig config) Compile(TextReader reader)
    {
        var modelfile = ModelfileParser.Parse(reader);
        return ModelfileConfigBuilder.ConfigFromModelfile(modelfile);
    }

    /// <summary>Parse Modelfile string and extract config.</summary>
    public static (string modelDir, ModelfileConfig config) Compile(string content)
    {
        var modelfile = ModelfileParser.Parse(content);
        return ModelfileConfigBuilder.ConfigFromModelfile(modelfile);
    }

    /// <summary>Extract config from an already-parsed Modelfile.</summary>
    public static (string modelDir, ModelfileConfig config) Compile(Modelfile modelfile)
        => ModelfileConfigBuilder.ConfigFromModelfile(modelfile);

    /// <summary>Export config as JSON for saving as a Cybria preset (e.g. under %LocalAppData%/Cybria/models/&lt;name&gt;.json).</summary>
    public static string ExportPresetJson(ModelfileConfig config, string modelDir, string? modelName = null)
    {
        var preset = new
        {
            from = modelDir,
            modelName = modelName ?? modelDir,
            template = config.Template,
            system = config.System,
            license = config.License,
            parser = config.Parser,
            renderer = config.Renderer,
            parameters = config.Parameters
        };
        return JsonSerializer.Serialize(preset, new JsonSerializerOptions { WriteIndented = true });
    }
}

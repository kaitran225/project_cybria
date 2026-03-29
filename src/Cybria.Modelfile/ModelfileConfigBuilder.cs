using System.Globalization;

namespace Cybria.Modelfile;

/// <summary>
/// Builds <see cref="ModelfileConfig"/> from a parsed <see cref="Modelfile"/>.
/// Port of Go x/create/client.ConfigFromModelfile.
/// </summary>
public static class ModelfileConfigBuilder
{
    private static readonly HashSet<string> IgnoredModelfileParameters = new(StringComparer.OrdinalIgnoreCase)
    {
        "penalize_newline", "low_vram", "f16_kv", "logits_all", "vocab_only",
        "use_mlock", "mirostat", "mirostat_tau", "mirostat_eta"
    };

    /// <summary>
    /// Known parameter keys that we parse to typed values (float, int, bool).
    /// Others are stored as string in Parameters.
    /// </summary>
    private static readonly HashSet<string> KnownNumericParams = new(StringComparer.OrdinalIgnoreCase)
    {
        "temperature", "top_p", "top_k", "num_ctx", "repeat_penalty", "repeat_last_n",
        "num_predict", "num_keep", "num_batch", "num_thread", "num_gpu", "batch_size",
        "num_parallel", "stop", "seed", "tfs_z", "typical_p", "frequency_penalty",
        "presence_penalty", "penalty_prompt_tokens", "penalty_frequency", "penalty_presence"
    };

    /// <summary>Extract model directory and config from a parsed Modelfile.</summary>
    /// <param name="modelfile">Parsed Modelfile.</param>
    /// <returns>(modelDir, config). modelDir is the FROM value or "." if empty.</returns>
    public static (string modelDir, ModelfileConfig config) ConfigFromModelfile(Modelfile modelfile)
    {
        var modelDir = "";
        var config = new ModelfileConfig();

        foreach (var cmd in modelfile.Commands)
        {
            switch (cmd.Name)
            {
                case "model":
                    modelDir = cmd.Args;
                    break;
                case "template":
                    config.Template = cmd.Args;
                    break;
                case "system":
                    config.System = cmd.Args;
                    break;
                case "license":
                    config.License = cmd.Args;
                    break;
                case "parser":
                    config.Parser = cmd.Args;
                    break;
                case "renderer":
                    config.Renderer = cmd.Args;
                    break;
                case "adapter":
                case "message":
                case "requires":
                    continue;
                default:
                    if (IgnoredModelfileParameters.Contains(cmd.Name))
                        continue;
                    var value = ParseParameterValue(cmd.Name, cmd.Args);
                    config.Parameters[cmd.Name] = value;
                    break;
            }
        }

        if (string.IsNullOrEmpty(modelDir))
            modelDir = ".";

        return (modelDir, config);
    }

    /// <summary>Parse a single parameter value to string, float, int, or bool (Option B).</summary>
    private static object ParseParameterValue(string key, string args)
    {
        var trimmed = args.Trim();
        if (KnownNumericParams.Contains(key))
        {
            if (float.TryParse(trimmed, NumberStyles.Float, CultureInfo.InvariantCulture, out var f))
                return f;
            if (int.TryParse(trimmed, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i))
                return i;
            if (trimmed.Equals("true", StringComparison.OrdinalIgnoreCase)) return true;
            if (trimmed.Equals("false", StringComparison.OrdinalIgnoreCase)) return false;
        }
        return trimmed;
    }
}

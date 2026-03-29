using Cybria.Modelfile;
using Xunit;

namespace Cybria.Modelfile.Tests;

public class ModelfileParserTests
{
    private static string PrototypeModelfilePath
    {
        get
        {
            // From bin/Debug/net8.0 go up to repo root (e.g. project_cybria) then .prototype/cybria.Modelfile
            var baseDir = AppContext.BaseDirectory;
            for (var i = 0; i < 8; i++)
            {
                var candidate = Path.Combine(baseDir, ".prototype", "cybria.Modelfile");
                if (File.Exists(candidate))
                    return Path.GetFullPath(candidate);
                baseDir = Path.GetDirectoryName(baseDir) ?? baseDir;
            }
            return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".prototype", "cybria.Modelfile"));
        }
    }

    [Fact]
    public void Parse_cybria_Modelfile_has_model_command()
    {
        var path = PrototypeModelfilePath;
        Assert.True(File.Exists(path), $"Prototype file not found: {path}");

        using var reader = new StreamReader(path);
        var modelfile = ModelfileParser.Parse(reader);

        var modelCmd = modelfile.Commands.FirstOrDefault(c => c.Name == "model");
        Assert.NotNull(modelCmd);
        Assert.Equal("nous-hermes2:latest", modelCmd.Args);
    }

    [Fact]
    public void Parse_cybria_Modelfile_has_system_and_parameters()
    {
        var path = PrototypeModelfilePath;
        Assert.True(File.Exists(path), $"Prototype file not found: {path}");

        var content = File.ReadAllText(path);
        var modelfile = ModelfileParser.Parse(content);

        var systemCmd = modelfile.Commands.FirstOrDefault(c => c.Name == "system");
        Assert.NotNull(systemCmd);
        Assert.Contains("Cybria", systemCmd.Args);
        Assert.Contains("KVI", systemCmd.Args);

        var paramCmds = modelfile.Commands.Where(c => c.Name == "temperature" || c.Name == "top_p" || c.Name == "frequency_penalty").ToList();
        Assert.True(paramCmds.Count >= 2, "Expected at least temperature and top_p parameters");
    }

    [Fact]
    public void ConfigFromModelfile_contains_system_and_parameters()
    {
        var path = PrototypeModelfilePath;
        Assert.True(File.Exists(path), $"Prototype file not found: {path}");

        var content = File.ReadAllText(path);
        var modelfile = ModelfileParser.Parse(content);
        var (modelDir, config) = ModelfileConfigBuilder.ConfigFromModelfile(modelfile);

        Assert.Equal("nous-hermes2:latest", modelDir);
        Assert.Contains("Cybria", config.System);
        Assert.True(config.Parameters.Count >= 2);
        Assert.True(config.Parameters.ContainsKey("temperature"));
        Assert.True(config.Parameters.ContainsKey("top_p"));
    }

    [Fact]
    public void Parse_simple_from_works()
    {
        var modelfile = ModelfileParser.Parse("FROM llama3:latest");
        Assert.Single(modelfile.Commands);
        Assert.Equal("model", modelfile.Commands[0].Name);
        Assert.Equal("llama3:latest", modelfile.Commands[0].Args);
    }

    [Fact]
    public void Parse_missing_from_throws()
    {
        Assert.Throws<ModelfileParserException>(() => ModelfileParser.Parse("SYSTEM hello"));
    }

    [Fact]
    public void Unquote_triple_quotes()
    {
        var (s, ok) = ModelfileParser.Unquote("\"\"\"a\nb\"\"\"");
        Assert.True(ok);
        Assert.Equal("a\nb", s);
    }
}

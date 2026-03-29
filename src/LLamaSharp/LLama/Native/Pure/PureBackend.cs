using System;
using System.IO;

namespace LLama.Native.Pure
{
    /// <summary>
    /// Pure C# backend entry points. Used when NativeLibraryConfig.UsePureCSharpBackend is true.
    /// </summary>
    internal static class PureBackend
    {
        public static PureModelState LoadModel(string modelPath, ref LLamaModelParams _)
        {
            using (var fs = new FileStream(modelPath, FileMode.Open, FileAccess.Read))
                if (!fs.CanRead)
                    throw new InvalidOperationException($"Model file '{modelPath}' is not readable");

            return PureModelState.Load(modelPath, useMmap: false, progress: null, IntPtr.Zero);
        }

        public static PureContextState CreateContext(PureModelState model, LLamaContextParams lparams)
        {
            uint nCtx = lparams.n_ctx > 0 ? lparams.n_ctx : (uint)model.NCtxTrain;
            return new PureContextState(model, nCtx);
        }
    }
}

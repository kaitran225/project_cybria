# FBX conversion helpers
#
# Milltina (Unity) -> FBX -> GLB for the web viewer
#
# ## Option A: Load raw FBX (no conversion)
#   tools/avatar-viewer — click "Load FBX"
#   Unity export settings: Binary FBX, FBX 7.4 or 7.5, embed textures
#
# ## Option B: FBX -> GLB via Blender
#   Install Blender: https://www.blender.org/download/
#
#   PowerShell:
#     .\tools\fbx-convert\convert.ps1 path\to\Milltina.fbx path\to\Milltina.glb
#
#   Then in avatar-viewer: Load GLB
#
# ## Option C: FBX -> VRM (best lip-sync / expressions)
#   1. Import FBX into Blender
#   2. Use VRM Add-on for Blender: https://vrm-addon-for-blender.info/
#   3. Export .vrm → Load VRM in avatar-viewer
#
# ## Unity package extraction
#   1. Open Unity → Assets → Import Package → Custom → Milltina.unitypackage
#   2. Select model prefab → Export to FBX (or use Unity FBX Exporter package)
#   3. Place .fbx under asset/Milltina_ver1.01.1/

"""
Blender headless: FBX -> GLB
Usage (inside Blender):
  blender --background --python fbx_to_glb.py -- input.fbx output.glb
"""
import sys

argv = sys.argv
if "--" not in argv:
    raise SystemExit("Pass input/output after --")
args = argv[argv.index("--") + 1 :]
if len(args) < 2:
    raise SystemExit("Usage: blender --background --python fbx_to_glb.py -- in.fbx out.glb")

in_path, out_path = args[0], args[1]

import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=in_path)
bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB")
print(f"Exported {out_path}")

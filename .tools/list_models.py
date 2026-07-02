"""Print the project model catalog with local feasibility on 8GB VRAM."""

from __future__ import annotations

import json
from pathlib import Path

_CATALOG = Path(__file__).resolve().parent / "model-catalog.json"


def main() -> int:
    data = json.loads(_CATALOG.read_text(encoding="utf-8"))
    print(f"Hardware note: {data.get('hardware_note', '')}\n")

    glm = data.get("glm_5_2", {})
    if glm:
        print("=== GLM-5.2 ===")
        print(f"  Repo: {glm.get('full_repo')}")
        print(f"  Runnable on 8GB VRAM: {glm.get('runnable_on_8gb_vram')}")
        print(f"  {glm.get('reason')}")
        print("  Alternatives on 8GB:")
        for alt in glm.get("alternatives_on_8gb", []):
            print(f"    - {alt}")
        print()

    by_cat: dict[str, list] = {}
    for m in data.get("models", []):
        by_cat.setdefault(m.get("category", "other"), []).append(m)

    for cat in sorted(by_cat):
        print(f"=== {cat} ===")
        for m in by_cat[cat]:
            run = m.get("runnable_local", "?")
            mark = {"yes": "OK", "tight": "TIGHT", "marginal": "MAYBE", "no": "NO"}.get(
                run, run
            )
            print(f"  [{mark}] {m.get('name')} ({m.get('id')})")
            print(f"       {m.get('repo_id')}")
            if m.get("integrated"):
                print(f"       integrated: {m['integrated']}")
            if m.get("serve"):
                print(f"       serve: {m['serve']}")
            if m.get("pull"):
                print(f"       pull: {m['pull']}")
            if m.get("note"):
                print(f"       {m['note']}")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

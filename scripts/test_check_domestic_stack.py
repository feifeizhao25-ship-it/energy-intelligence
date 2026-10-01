#!/usr/bin/env python3
"""check_domestic_stack.py 的自测：门禁必须真的在扫源码，并且真的会红。

背景：
  · 直接运行 `python3 scripts/check_domestic_stack.py`（不带参数）时 source-roots 默认为空，
    只扫 compose / env 样例，一行境外 SDK 的 import 都扫不到——门禁「空转」。
  · 例外清单里曾为 runtime/web/src/lib/supabase.ts 留了两条例外；文件删除后例外必须一并删除，
    否则它成了一张随时能把 Supabase 放回来的空白支票。
"""
import contextlib
import io
import json
import pathlib
import shutil
import tempfile
import unittest

import check_domestic_stack as gate

REPO = gate.REPO


def run_gate(*argv: str) -> tuple[int, str]:
    out = io.StringIO()
    old = gate.sys.argv
    gate.sys.argv = ["check_domestic_stack.py", *argv]
    try:
        with contextlib.redirect_stdout(out):
            code = gate.main()
    finally:
        gate.sys.argv = old
    return code, out.getvalue()


class DomesticStackGateTests(unittest.TestCase):
    def test_default_run_scans_web_source_and_passes(self):
        code, out = run_gate()
        self.assertEqual(code, 0, out)
        self.assertNotIn("0 个源码目录", out)

    def test_default_source_roots_cover_web(self):
        self.assertIn("runtime/web/src", gate.DEFAULT_SOURCE_ROOTS)

    def test_allowlist_has_no_supabase_exceptions(self):
        data = json.loads(gate.ALLOWLIST.read_text(encoding="utf-8"))
        for item in data["allow"]:
            self.assertNotIn("supabase", (item["where"] + item["what"]).lower(), item)

    def test_supabase_source_file_and_dependency_are_gone(self):
        self.assertFalse((REPO / "runtime/web/src/lib/supabase.ts").exists())
        pkg = json.loads((REPO / "runtime/web/package.json").read_text(encoding="utf-8"))
        deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
        self.assertNotIn("@supabase/supabase-js", deps)

    # ---- 变异：故意写一个违规，门禁必须红 ----
    def _scan_planted(self, filename: str, content: str) -> tuple[int, str]:
        tmp = pathlib.Path(tempfile.mkdtemp(dir=REPO / "scripts", prefix=".planted_"))
        try:
            (tmp / filename).write_text(content, encoding="utf-8")
            return run_gate("--source-roots", str(tmp.relative_to(REPO)))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_planted_supabase_import_fails_the_gate(self):
        code, out = self._scan_planted("x.ts", "import { createClient } from '@supabase/supabase-js';\n")
        self.assertEqual(code, 1)
        self.assertIn("@supabase/supabase-js", out)

    def test_planted_offshore_host_fails_the_gate(self):
        code, out = self._scan_planted("x.ts", "fetch('https://api.stripe.com/v1/charges');\n")
        self.assertEqual(code, 1)
        self.assertIn("api.stripe.com", out)

    def test_planted_offshore_dependency_in_manifest_fails_the_gate(self):
        # 没有被 import、只是声明在 package.json 里的境外 SDK，同样会被装进镜像
        tmp = pathlib.Path(tempfile.mkdtemp(dir=REPO / "scripts", prefix=".planted_"))
        try:
            (tmp / "src").mkdir()
            (tmp / "src" / "x.ts").write_text("export const a = 1;\n", encoding="utf-8")
            (tmp / "package.json").write_text(
                json.dumps({"dependencies": {"@supabase/supabase-js": "^2", "stripe": "^1"}}), encoding="utf-8")
            code, out = run_gate("--source-roots", str((tmp / "src").relative_to(REPO)))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        self.assertEqual(code, 1)
        self.assertIn("@supabase/supabase-js", out)
        self.assertIn("stripe", out)

    def test_browser_side_offshore_hosts_are_caught(self):
        # 浏览器直连的境外静态资源/地图/字体，以及同一文件里的多个境外主机，都要逐个报出来；
        # 第一版门禁只认 SDK 与少数主机，且一个文件只报第一个——unpkg、OSM、NASA 等全是盲区
        code, out = self._scan_planted(
            "x.tsx",
            "const a = 'https://unpkg.com/leaflet/dist/leaflet.js';\n"
            "const b = 'https://nominatim.openstreetmap.org/search';\n"
            "const c = 'https://power.larc.nasa.gov/api';\n",
        )
        self.assertEqual(code, 1)
        for host in ("unpkg.com", "openstreetmap.org", "power.larc.nasa.gov"):
            self.assertIn(host, out)

    def test_every_allowlist_entry_has_a_why_and_points_to_an_existing_file(self):
        data = json.loads(gate.ALLOWLIST.read_text(encoding="utf-8"))
        for item in data["allow"]:
            self.assertTrue(str(item.get("why", "")).strip(), item)
            self.assertTrue((REPO / item["where"].split("::")[0]).exists(), f"例外指向不存在的文件：{item['where']}")

    def test_clean_source_passes(self):
        code, _ = self._scan_planted("x.ts", "export const a = 1;\n")
        self.assertEqual(code, 0)


if __name__ == "__main__":
    unittest.main()

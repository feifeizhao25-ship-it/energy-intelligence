"""
批量为空的 Skill stub 添加基本功能框架。
扫描 backend/skills/ 下所有 ~37 行的空 stub，为其添加参数解析和基础返回值。
"""
import os
import re
from pathlib import Path

SKILLS_DIR = Path(__file__).parent.parent / "skills"

STUB_TEMPLATE = '''
    def _get_default_params(self) -> dict:
        return {{
            "capacity_mw": 100,
            "project_life_years": 25,
            "discount_rate": 0.08,
        }}

    def _process(self, params: dict) -> dict:
        """基础处理：返回带元数据的参数摘要。"""
        return {{
            "skill_id": self.SKILL_ID,
            "skill_name": self.SKILL_NAME,
            "params_received": params,
            "status": "processed",
            "note": "This skill has a basic implementation. Full algorithm will be added in a future release.",
        }}
'''

def enrich_stub(filepath: Path):
    content = filepath.read_text(encoding="utf-8")
    lines = content.splitlines()
    
    # Only process ~37-line stubs that lack a _calculate or _process method
    if len(lines) > 45 or "_calculate" in content or "_process" in content:
        return False
    
    # Find the execute method and inject _process before it or replace the empty return
    # Pattern: return XxxOutput(result={...}, success=True)
    new_content = re.sub(
        r'(    def execute\(self, input_data:.+?\) -> .+?:\n        try:\n            params = input_data\.params\n)(\n            return .+?\(result=\{"skill_id": self\.SKILL_ID.*\}, success=True\))',
        r'\1            result = self._process(params)\n\2',
        content,
        flags=re.DOTALL,
    )
    
    # If replacement didn't happen (different pattern), try another approach
    if new_content == content:
        # Add _process method before the execute function or at the end of class
        # Find the line with `def execute` and add _process before it
        insert_idx = None
        for i, line in enumerate(lines):
            if line.strip().startswith("def execute("):
                insert_idx = i
                break
        
        if insert_idx is not None:
            # Update execute to call _process
            for j in range(insert_idx, min(insert_idx + 10, len(lines))):
                if "result={" in lines[j] and "skill_id" in lines[j]:
                    indent = len(lines[j]) - len(lines[j].lstrip())
                    lines[j] = lines[j].replace(
                        "result={",
                        f"result=self._process(params)  # {{")
                    lines[j] = lines[j].split("  # ")[0] + ""
                    # Actually just replace the return line
                    # Let's use regex on the specific return pattern
                    break
            
            # Insert _process before execute
            process_lines = [
                "    def _process(self, params: dict) -> dict:",
                '        """Basic parameter processing with metadata."""',
                "        return {",
                '            "skill_id": self.SKILL_ID,',
                '            "skill_name": self.SKILL_NAME,',
                '            "params_received": params,',
                '            "status": "processed",',
                '            "note": "Basic implementation. Full algorithm will be added in a future release.",',
                "        }",
                "",
            ]
            lines = lines[:insert_idx] + process_lines + lines[insert_idx:]
            new_content = "\n".join(lines)
        else:
            return False
    
    filepath.write_text(new_content, encoding="utf-8")
    return True


def main():
    enriched = 0
    for root, _, files in os.walk(SKILLS_DIR):
        for fname in files:
            if not fname.endswith(".py") or fname == "__init__.py":
                continue
            fpath = Path(root) / fname
            lines = fpath.read_text(encoding="utf-8").splitlines()
            # Target ~37-line stubs
            if 30 <= len(lines) <= 42:
                if enrich_stub(fpath):
                    enriched += 1
                    print(f"Enriched: {fpath.relative_to(SKILLS_DIR.parent)}")
    
    print(f"\nTotal enriched: {enriched}")


if __name__ == "__main__":
    main()

"""Workflow paths point at runtime/backend, and the research cycle file exists."""
from __future__ import annotations

from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[3]
WORKFLOW = REPO / ".github" / "workflows" / "knowledge-improvement.yml"
SKILL = REPO / ".agents" / "skills" / "cn-energy-evidence" / "SKILL.md"
CYCLE = REPO / "automation" / "domestic_research" / "cycle.py"


class _WorkflowLoader(yaml.SafeLoader):
    """GitHub Actions 把 on 当普通键。PyYAML 1.1 会把 on 读成布尔，这里关掉这项。"""


for _chars, _entries in list(_WorkflowLoader.yaml_implicit_resolvers.items()):
    _WorkflowLoader.yaml_implicit_resolvers[_chars] = [
        (tag, pattern) for tag, pattern in _entries if tag != "tag:yaml.org,2002:bool"
    ]


def _workflow() -> dict:
    text = WORKFLOW.read_text(encoding="utf-8")
    loaded = yaml.load(text, _WorkflowLoader)
    assert isinstance(loaded, dict)
    assert loaded["jobs"]["audit"]["defaults"]["run"]["working-directory"] == "runtime/backend"
    blob = yaml.dump(loaded["on"]) + yaml.dump(loaded["jobs"])
    assert "后端/" not in blob
    return loaded


def test_workflow_yaml_parses_and_targets_runtime_backend():
    loaded = _workflow()
    job = loaded["jobs"]["audit"]
    assert job["defaults"]["run"]["working-directory"] == "runtime/backend"
    cache = job["steps"][1]["with"]["cache-dependency-path"]
    assert cache == "runtime/backend/requirements.txt"
    assert (REPO / cache).is_file()


def test_workflow_paths_exist():
    loaded = _workflow()
    paths = loaded["on"]["push"]["paths"]
    assert paths
    for raw in paths:
        assert "后端" not in raw
        assert (REPO / raw).exists(), raw
    steps = loaded["jobs"]["audit"]["steps"]
    joined = "\n".join(str(step) for step in steps)
    assert "tests/test_knowledge_improvement_paths.py" in joined
    assert "scripts/knowledge_improvement_audit.py" in joined
    assert "--online" not in joined
    assert (REPO / "runtime/backend/scripts/knowledge_improvement_audit.py").is_file()
    assert (REPO / "runtime/backend/app/services/rag_refresh.py").is_file()
    assert (REPO / "runtime/backend/app/services/continuous_improvement.py").is_file()


def test_skill_points_at_the_offline_cycle():
    text = SKILL.read_text(encoding="utf-8")
    assert "automation/domestic_research/cycle.py" in text
    assert CYCLE.is_file()
    assert "面向用户的业务知识库" in text


def test_cycle_searches_the_local_index_and_does_not_publish(tmp_path):
    import importlib.util

    spec = importlib.util.spec_from_file_location("domestic_research_cycle", CYCLE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    report = module.run("energy", "pvlib")
    assert report["ok"] is True
    assert report["wrote_knowledge_base"] is False
    assert report["auto_publish"] is False
    assert report["network"] is False
    assert any(hit["name"] == "pvlib/pvlib-python" and hit["usable"] for hit in report["hits"])
    other = module.run("shunshi", "节气")
    assert other["ok"] is False and other["hits"] == []
    assert module.main(["--product", "energy", "--query", "pvlib"]) == 0

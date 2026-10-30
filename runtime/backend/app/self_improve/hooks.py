"""新能源智库接入层：把公共 SIL 内核接到现有的评测、来源注册表和企业微信审批上。

不重做已有闭环：政策抓取 → 快照 → 差异 → 企微审批 → 入库仍由 app.services.policy_pipeline 负责。
这里只做每周的「自改进」：
  collect  列出已到复核期的 RAG 来源（rag_sources.json 的 freshness_status），不联网；
  propose  每个到期来源提一条「请人工对照官方原文复核」的候选（用户可见 → 必须审批）；
  evaluate 读取 eval_runner 写出的 latest.json（过期或缺项 → 指标缺失 → 门禁 fail-closed）；
  apply    只把来源写进复核队列 needs_reverify.json，不改 rag_sources.json 正文。
审批：沿用 ops.wecom.submit_approval（OA 审批，绑定内容 sha256）。名单 POLICY_REVIEWERS 为空时无人能批。
TODO(owner): 填写 POLICY_REVIEWERS（企业微信 userid，逗号分隔）。本代码与自动化流程不得代填。
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import date, datetime, timezone
from pathlib import Path

from .approval import ApprovalPolicy
from .config import SILConfig
from .gates import GateThresholds
from .loop import EvalOutcome, Hooks, SelfImprovementLoop
from .store import Candidate

ROOT = Path(__file__).resolve().parents[2]
RECALL_FILE = ROOT / "data" / "eval" / "retrieval_recall.json"

# 新能源没有「忠实度」自动指标（由 citation/freshness/红队/计算复核代替），该项不适用；其余按公共默认值。
# recall_at_8 是「不含拒答题」的召回；下限取扩充前旧语料按同一口径算出的值（golden_v1 为 1.0），比通用默认 0.85 更严。
# 拒答题改由 refusal_accuracy 把关，下限 1.0。指标缺失一律不通过。
RECALL_AT_8_MIN = 1.0
REFUSAL_ACCURACY_MIN = 1.0
THRESHOLDS = GateThresholds(
    recall_at_8_min=RECALL_AT_8_MIN,
    not_applicable=frozenset({"faithfulness"}),
    extra_floors=(("refusal_accuracy", REFUSAL_ACCURACY_MIN),),
)
FAMILIES = ("investment_advice", "return_promise", "rating", "absolute_claim")


def build_config(env=None) -> SILConfig:
    return SILConfig.from_env("energy", env, allowed_domains=("ndrc.gov.cn", "nea.gov.cn", "gov.cn", "samr.gov.cn", "mee.gov.cn", "miit.gov.cn"), thresholds=THRESHOLDS, families=FAMILIES)


def _read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def measured_metrics(eval_file: Path | None = None, now: datetime | None = None, recall_file: Path = RECALL_FILE) -> dict:
    """把 eval_runner 的实测值映射成门禁指标。缺失/过期（>8 天）返回空字典 → fail-closed。"""
    from app.services.skill_improvement import eval_latest_path, load_eval_metrics

    loaded = load_eval_metrics(eval_file or eval_latest_path(), now=now)
    if not loaded["ok"]:
        return {}
    m = loaded["metrics"]
    ref, act = m["calculator_reference"], m["calculator_actual"]
    out = {
        "citation_accuracy": float(m["citation_accuracy"]),
        "freshness_correctness": float(m["freshness_correctness"]),
        "redteam_pass_rate": float(m["redteam_blocked"]),
        "calc_error": abs(act - ref) / abs(ref) if ref else 1.0,
        "cost_ratio": 1.0,  # 候选只改复核队列，不改模型调用
        "latency_ratio": 1.0,
    }
    stored = _read_json(recall_file, {})
    for key in ("recall_at_8", "refusal_accuracy"):
        value = stored.get(key)
        if isinstance(value, (int, float)):
            out[key] = float(value)
    return out


class EnergyHooks:
    def __init__(self, data_dir: str, *, today: date | None = None, registry=None, eval_file: Path | None = None, now: datetime | None = None):
        self.data = Path(data_dir)
        self.today = today or date.today()
        self.eval_file = eval_file
        self.now = now
        self._registry = registry
        self.data.mkdir(parents=True, exist_ok=True)

    def registry(self):
        if self._registry is None:
            from app.services.rag_sources import SourceRegistry

            self._registry = SourceRegistry.from_file()
        return self._registry

    @property
    def queue_path(self) -> Path:
        return self.data / "needs_reverify.json"

    def _queue(self) -> list[dict]:
        return _read_json(self.queue_path, [])

    # collect：只读，不联网
    def collect(self):
        reg = self.registry()
        for s in reg.sources:
            status = reg.freshness_of(s, today=self.today)
            if status in ("stale", "review_recommended"):
                yield {"id": s["source_id"], "origin": "internal", "license": "internal", "kind": "reverify", "title": s.get("title", ""), "url": s.get("source_url", ""), "freshness": status}

    def propose(self, records, budget: int) -> list[Candidate]:
        out: list[Candidate] = []
        for r in sorted(records, key=lambda x: (x.get("freshness") != "stale", x["id"])):  # 已过期的先提
            if len(out) >= budget:
                break
            digest = hashlib.sha256(f"{r['id']}:{r['freshness']}:{self.today.isoformat()}".encode()).hexdigest()[:10]
            out.append(Candidate(
                id=f"reverify-{r['id']}-{digest}", kind="kb_entry", target=r["id"], origin="internal", user_visible=True,
                summary=f"来源「{r['title'][:40]}」已到复核期（{r['freshness']}），请人工对照官方原文复核。",
                payload={"action": "reverify", "source_id": r["id"], "url": r["url"]}, evidence=[{"url": r["url"]}]))
        return out

    def evaluate(self, c: Candidate) -> EvalOutcome:
        cand = measured_metrics(self.eval_file, self.now)
        base_path = self.data / "eval_baseline.json"
        base = _read_json(base_path, None) or dict(cand)  # 第一次：以当前实测为基线
        if cand and not base_path.exists():
            base_path.write_text(json.dumps(base, ensure_ascii=False, indent=1), encoding="utf-8")
        # 没有检索 = 不可能给出带出处的回答
        return EvalOutcome(base, cand, no_skill={"recall_at_8": 0.0})

    def apply(self, c: Candidate) -> dict:
        before = self._queue()
        sid = c.payload["source_id"]
        queue = [x for x in before if x.get("source_id") != sid] + [{"source_id": sid, "url": c.payload.get("url", ""), "queued_by": c.id}]
        self.queue_path.write_text(json.dumps(queue, ensure_ascii=False, indent=1), encoding="utf-8")
        return {"queue_before": before}

    def rollback(self, c: Candidate) -> None:
        before = (c.snapshot or {}).get("queue_before", [])
        self.queue_path.write_text(json.dumps(before, ensure_ascii=False, indent=1), encoding="utf-8")

    def entries(self):
        for s in self.registry().sources:
            yield {"id": s["source_id"], "source_tier": "official" if s.get("source_tier") == "一手官方" else "legacy_unverified", "license": "official-public" if s.get("source_tier") == "一手官方" else "internal",
                   "valid_from": s.get("effective_date") or s.get("published_at"), "valid_until": s.get("expiry_date") or "2099-12-31", "content_hash": s.get("snapshot_sha256"), "origin": "external", "url": s.get("source_url"), "superseded_by": s.get("superseded_by")}

    def hooks(self) -> Hooks:
        return Hooks(collect=self.collect, propose=self.propose, evaluate=self.evaluate, apply=self.apply, rollback=self.rollback, entries=self.entries)


class OAGateway:
    """把 SIL 的审批卡片接到新能源已有的企业微信 OA 审批（ops.wecom.submit_approval，绑定内容 sha256）。

    未配置企业微信时 submit_approval 只返回 submitted=False，这里把它当作「发送失败」：提案停在待审，
    超时作废，永不因为发不出去而晋升。
    """

    def __init__(self, submit=None, template: str = "content"):
        self._submit = submit
        self.template = template

    def send(self, card: dict, to_users: list[str]) -> str:
        from ops.wecom import submit_approval

        digest = hashlib.sha256(json.dumps(card, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        res = (self._submit or submit_approval)(self.template, digest) or {}
        if not res.get("submitted"):
            raise RuntimeError(f"wecom_oa_not_submitted:{res.get('reason', 'unknown')}")
        return str(res.get("sp_no") or "")


def build_loop(env=None, *, data_dir: str | None = None, gateway=None, **kw) -> tuple[SelfImprovementLoop, EnergyHooks]:
    cfg = build_config(env)
    if data_dir:
        cfg = SILConfig(**{**cfg.__dict__, "data_dir": data_dir})
    eh = EnergyHooks(cfg.data_dir, **kw)
    return SelfImprovementLoop(cfg, eh.hooks(), approval=ApprovalPolicy.from_env(env), gateway=gateway or OAGateway()), eh


def run_weekly(now: datetime | None = None, env=None) -> dict:
    """Celery 入口。SIL_ENABLED 未打开时直接返回 disabled，不读文件、不联网。"""
    from .scheduler import TZ

    env = os.environ if env is None else env
    if not build_config(env).enabled:
        return {"status": "disabled"}
    loop, _ = build_loop(env)
    rep = loop.run_weekly(now or datetime.now(TZ))
    return {k: v for k, v in rep.__dict__.items()}


def run_monthly(today: date | None = None, env=None) -> dict:
    env = os.environ if env is None else env
    if not build_config(env).enabled:
        return {"status": "disabled"}
    loop, _ = build_loop(env)
    return loop.run_monthly(today or date.today())

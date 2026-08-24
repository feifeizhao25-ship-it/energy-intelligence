"""Auditable RAG/skill improvement state machine."""

from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from typing import Dict, Optional


@dataclass(frozen=True)
class ImprovementCandidate:
    candidate_id: str
    source_url: str
    state: str = "discovered"
    license_spdx: Optional[str] = None
    evidence_score: Optional[float] = None
    safety_score: Optional[float] = None
    approved_by: Optional[str] = None
    previous_release: Optional[str] = None
    updated_at: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)


class ImprovementWorkflow:
    """Discovery can be automated; approval and release cannot be skipped."""

    _transitions = {
        "discovered": {"license_checked", "rejected"},
        "license_checked": {"quarantined", "rejected"},
        "quarantined": {"evaluated", "rejected"},
        "evaluated": {"approved", "rejected"},
        "approved": {"published", "rejected"},
        "published": {"rolled_back"},
    }

    def transition(
        self,
        candidate: ImprovementCandidate,
        target: str,
        actor: Optional[str] = None,
        evidence_score: Optional[float] = None,
        safety_score: Optional[float] = None,
    ) -> ImprovementCandidate:
        if target not in self._transitions.get(candidate.state, set()):
            raise ValueError("非法状态迁移: %s -> %s" % (candidate.state, target))
        next_evidence = (
            evidence_score
            if evidence_score is not None
            else candidate.evidence_score
        )
        next_safety = (
            safety_score if safety_score is not None else candidate.safety_score
        )
        if target == "approved":
            if not actor:
                raise PermissionError("发布前审批必须记录责任人")
            if next_evidence is None or next_safety is None:
                raise ValueError("审批前必须完成证据与安全评测")
            if min(next_evidence, next_safety) < 0.85:
                raise ValueError("候选未达到 0.85 发布门槛")
        return replace(
            candidate,
            state=target,
            approved_by=actor if target == "approved" else candidate.approved_by,
            evidence_score=next_evidence,
            safety_score=next_safety,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )

"""
GDPR background tasks — executed asynchronously via Celery.
"""
import json
import asyncio
from datetime import datetime, timezone
from app.tasks.celery_app import celery_app


def _get_sync_db_session():
    """Create a synchronous DB session for use inside Celery tasks."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.config import settings

    # Use sync URL (replace asyncpg prefix with postgresql)
    sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
    engine = create_engine(sync_url, pool_pre_ping=True, pool_size=2, max_overflow=3)
    Session = sessionmaker(bind=engine)
    return Session()


@celery_app.task(bind=True, name="gdpr.export_data")
def export_user_data(self, user_id: str, user_email: str):
    """
    GDPR Right of Access — compile all user data and send export email.
    Runs asynchronously via Celery.
    """
    from app.models.database import User, Project, ResourceAssessment, FinancialModel, ConsentRecord
    from sqlalchemy import select

    session = _get_sync_db_session()
    try:
        user = session.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        if not user:
            return {"status": "error", "message": "User not found"}

        data = {
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "company": user.company,
                "role": user.role,
                "country": user.country,
                "plan": user.plan,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            },
            "projects": [],
            "resource_assessments": [],
            "financial_models": [],
            "consent": {},
        }

        projects = session.execute(select(Project).where(Project.user_id == user_id)).scalars().all()
        project_ids = [p.id for p in projects]
        data["projects"] = [
            {
                "id": p.id, "name": p.name, "technology": p.technology,
                "capacity_mw": p.capacity_mw, "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in projects
        ]

        if project_ids:
            assessments = session.execute(
                select(ResourceAssessment).where(ResourceAssessment.project_id.in_(project_ids))
            ).scalars().all()
            data["resource_assessments"] = [
                {
                    "id": r.id, "project_id": r.project_id, "technology": r.technology,
                    "ghi": r.ghi, "wind_speed": r.wind_speed, "score": r.score,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in assessments
            ]

            models = session.execute(
                select(FinancialModel).where(FinancialModel.project_id.in_(project_ids))
            ).scalars().all()
            data["financial_models"] = [
                {
                    "id": m.id, "project_id": m.project_id, "scenario_name": m.scenario_name,
                    "irr": m.irr, "npv": m.npv, "lcoe": m.lcoe,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in models
            ]

        consent = session.execute(select(ConsentRecord).where(ConsentRecord.user_id == user_id)).scalar_one_or_none()
        if consent:
            data["consent"] = {
                "marketing": consent.marketing,
                "analytics": consent.analytics,
                "third_party": consent.third_party,
            }

        # Send email with export data (placeholder)
        _send_export_email(user_email, data)

        return {"status": "ok", "record_count": len(json.dumps(data))}

    finally:
        session.close()


@celery_app.task(bind=True, name="gdpr.delete_account")
def delete_user_account(self, user_id: str):
    """
    GDPR Right to Erasure — permanently delete user account and all data.
    Scheduled to run after 30-day grace period via Celery eta.
    """
    from app.models.database import User, Project, ResourceAssessment, FinancialModel, ConsentRecord
    from sqlalchemy import delete

    session = _get_sync_db_session()
    try:
        # Delete related records first (cascading)
        project_ids = [p.id for p in session.execute(
            select(Project.id).where(Project.user_id == user_id)
        ).scalars().all()]

        if project_ids:
            session.execute(delete(ResourceAssessment).where(ResourceAssessment.project_id.in_(project_ids)))
            session.execute(delete(FinancialModel).where(FinancialModel.project_id.in_(project_ids)))

        session.execute(delete(Project).where(Project.user_id == user_id))
        session.execute(delete(ConsentRecord).where(ConsentRecord.user_id == user_id))
        session.execute(delete(User).where(User.id == user_id))
        session.commit()

        return {"status": "ok", "deleted_user_id": user_id}

    except Exception as e:
        session.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        session.close()


def _send_export_email(email: str, data: dict):
    """Send GDPR data export email via SendGrid."""
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        from app.config import settings

        if not settings.SENDGRID_API_KEY:
            print(f"[GDPR Export] Would send export email to {email} with {len(json.dumps(data))} bytes")
            return

        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        msg = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=email,
            subject="Your Energy Intelligence Data Export",
            html_content=f"""
            <p>Your Energy Intelligence data export is attached/pavailable.</p>
            <p>Data summary: {len(json.dumps(data))} bytes of records.</p>
            <p>If you have questions, contact privacy@energy-global.com</p>
            """,
        )
        sg.send(msg)
    except Exception as e:
        print(f"[GDPR Export] Failed to send email: {e}")

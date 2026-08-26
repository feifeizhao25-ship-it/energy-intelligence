"""Projects API — full CRUD with SQLAlchemy async queries."""
import logging
import uuid
import secrets
router = APIRouter(prefix="/projects")
logger = logging.getLogger(__name__)
        except Exception as exc:
            logger.warning("Assessment task %s failed: %s", task_id, exc)
            try:
                task = await db.get(Task, task_id)
                if task:
                    task.status = "failed"
                    task.error = str(exc)
                    await db.commit()
            except Exception as update_exc:
                logger.warning("Unable to persist failed assessment task %s: %s", task_id, update_exc)
        except Exception as exc:
            logger.warning("Diagnostic task %s failed: %s", task_id, exc)
            try:
                task = await db.get(Task, task_id)
                if task:
                    task.status = "failed"
                    task.error = str(exc)
                    await db.commit()
            except Exception as update_exc:
                logger.warning("Unable to persist failed diagnostic task %s: %s", task_id, update_exc)

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _get_owned_task(task_id: int, user: models.User, db: Session) -> models.Task:
    task = (
        db.query(models.Task)
        .filter(models.Task.id == task_id, models.Task.user_id == user.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("", response_model=List[schemas.TaskOut])
def list_tasks(
    status_filter: Optional[models.StatusEnum] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    query = db.query(models.Task).filter(models.Task.user_id == current_user.id)
    if status_filter:
        query = query.filter(models.Task.status == status_filter)
    return query.order_by(models.Task.due_date.is_(None), models.Task.due_date.asc()).all()


@router.get("/stats", response_model=schemas.TaskStats)
def task_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Aggregated counts for the dashboard header.
    Written as a single JOIN + aggregate query instead of four round trips.
    """
    row = (
        db.query(
            func.count(models.Task.id).label("total"),
            func.sum(case((models.Task.status == "pending", 1), else_=0)).label("pending"),
            func.sum(case((models.Task.status == "in_progress", 1), else_=0)).label("in_progress"),
            func.sum(case((models.Task.status == "completed", 1), else_=0)).label("completed"),
            func.sum(
                case(
                    (
                        (models.Task.due_date < date.today())
                        & (models.Task.status != "completed"),
                        1,
                    ),
                    else_=0,
                )
            ).label("overdue"),
        )
        .join(models.User, models.User.id == models.Task.user_id)
        .filter(models.User.id == current_user.id)
        .first()
    )

    return schemas.TaskStats(
        total=row.total or 0,
        pending=row.pending or 0,
        in_progress=row.in_progress or 0,
        completed=row.completed or 0,
        overdue=row.overdue or 0,
    )


@router.post("", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    task = models.Task(**task_in.model_dump(), user_id=current_user.id)
    try:
        db.add(task)
        db.commit()
        db.refresh(task)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not create task")
    return task


@router.get("/{task_id}", response_model=schemas.TaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _get_owned_task(task_id, current_user, db)


@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(
    task_id: int,
    task_in: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    task = _get_owned_task(task_id, current_user, db)
    updates = task_in.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(task, field, value)

    try:
        db.commit()
        db.refresh(task)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update task")
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    task = _get_owned_task(task_id, current_user, db)
    try:
        db.delete(task)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not delete task")
    return None

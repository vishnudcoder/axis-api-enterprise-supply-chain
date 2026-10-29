import json
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def write_business_audit(
    db: Session,
    *,
    actor_user_id: str | UUID,
    action_code: str,
    record_schema: str,
    record_table: str,
    record_key: dict[str, Any],
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
    changed_fields: list[str] | None = None,
    reason: str | None = None,
) -> None:
    """
    Add an audit row to the current transaction.
    The caller is responsible for committing or rolling back.
    """
    if action_code not in {"INSERT", "UPDATE", "DELETE"}:
        raise ValueError("Unsupported business audit action")

    UUID(str(actor_user_id))

    db.execute(
        text("""
            INSERT INTO audit.audit_event (
                actor_user_id,
                action_code,
                record_schema,
                record_table,
                reason,
                before_state,
                after_state,
                changed_fields,
                source_application,
                record_key
            )
            VALUES (
                CAST(:actor_user_id AS uuid),
                :action_code,
                :record_schema,
                :record_table,
                :reason,
                CAST(:before_state AS jsonb),
                CAST(:after_state AS jsonb),
                CAST(:changed_fields AS jsonb),
                :source_application,
                CAST(:record_key AS jsonb)
            )
        """),
        {
            "actor_user_id": str(actor_user_id),
            "action_code": action_code,
            "record_schema": record_schema,
            "record_table": record_table,
            "reason": reason,
            "before_state": (
                json.dumps(before_state, default=str)
                if before_state is not None else None
            ),
            "after_state": (
                json.dumps(after_state, default=str)
                if after_state is not None else None
            ),
            "changed_fields": (
                json.dumps(changed_fields)
                if changed_fields is not None else None
            ),
            "source_application": "AXIS Pharma API",
            "record_key": json.dumps(record_key, default=str),
        },
    )

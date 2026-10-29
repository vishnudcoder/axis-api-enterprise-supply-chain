from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.business_audit import write_business_audit


def test_audit_insert_uses_current_transaction():
    db = MagicMock()
    actor_id = uuid4()

    write_business_audit(
        db,
        actor_user_id=actor_id,
        action_code="INSERT",
        record_schema="public",
        record_table="equipment",
        record_key={"id": 42},
        after_state={"equipment_code": "EQ-042"},
        changed_fields=["equipment_code"],
    )

    db.execute.assert_called_once()
    db.commit.assert_not_called()

    params = db.execute.call_args.args[1]
    assert params["actor_user_id"] == str(actor_id)
    assert params["action_code"] == "INSERT"
    assert params["record_schema"] == "public"
    assert params["record_table"] == "equipment"
    assert params["record_key"] == '{"id": 42}'
    assert params["after_state"] == '{"equipment_code": "EQ-042"}'


def test_audit_rejects_unsupported_action_without_database_query():
    db = MagicMock()

    with pytest.raises(ValueError):
        write_business_audit(
            db,
            actor_user_id=uuid4(),
            action_code="TRUNCATE",
            record_schema="public",
            record_table="equipment",
            record_key={"id": 42},
        )

    db.execute.assert_not_called()


def test_audit_rejects_invalid_actor_uuid_without_database_query():
    db = MagicMock()

    with pytest.raises(ValueError):
        write_business_audit(
            db,
            actor_user_id="not-a-uuid",
            action_code="DELETE",
            record_schema="public",
            record_table="equipment",
            record_key={"id": 42},
        )

    db.execute.assert_not_called()

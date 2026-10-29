from datetime import datetime, timezone
from types import SimpleNamespace

from app.equipment import equipment_audit_snapshot


def test_equipment_audit_snapshot_converts_datetimes():
    now = datetime(2026, 10, 16, 10, 30, tzinfo=timezone.utc)
    equipment = SimpleNamespace(
        id=7,
        equipment_code="EQ-TEST-007",
        equipment_name="Test Mixer",
        equipment_type="Mixer",
        location="Production",
        capacity=100,
        capacity_unit="L",
        status="Operational",
        maintenance_status="Up to Date",
        last_maintenance=now,
        next_maintenance=None,
        utilization_percent=25,
        assigned_reactor=None,
        manufacturer="Test Manufacturer",
        serial_number="SN-007",
        notes=None,
        created_at=now,
        updated_at=now,
    )

    result = equipment_audit_snapshot(equipment)

    assert result["id"] == 7
    assert result["last_maintenance"] == now.isoformat()
    assert result["next_maintenance"] is None
    assert result["created_at"] == now.isoformat()
    assert result["updated_at"] == now.isoformat()

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.equipment import create_equipment
from app.schemas import CreateEquipmentRequest


def test_create_equipment_rolls_back_when_audit_fails():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    payload = CreateEquipmentRequest(
        equipment_code="EQ-TEST-ROLLBACK",
        equipment_name="Rollback Test",
        equipment_type="Mixer",
        location="Production",
        capacity=100,
        capacity_unit="L",
        status="Operational",
        maintenance_status="Up to Date",
        utilization_percent=0,
    )
    identity = {"user_id": "0a4d2e47-2693-4ef2-af9e-22a72bae913d"}

    with patch(
        "app.equipment.write_equipment_audit",
        side_effect=RuntimeError("Simulated audit failure"),
    ):
        with pytest.raises(RuntimeError, match="Simulated audit failure"):
            create_equipment(payload=payload, db=db, identity=identity)

    db.add.assert_called_once()
    db.flush.assert_called_once()
    db.rollback.assert_called_once()
    db.commit.assert_not_called()

from app.equipment import (
    create_equipment,
    update_equipment,
    update_equipment_status,
    delete_equipment,
)
from app.schemas import CreateEquipmentRequest, UpdateEquipmentRequest


TEST_IDENTITY = {"user_id": "0a4d2e47-2693-4ef2-af9e-22a72bae913d"}


def make_equipment():
    now = datetime(2026, 10, 16, 10, 30, tzinfo=timezone.utc)
    return SimpleNamespace(
        id=7,
        equipment_code="EQ-TEST-007",
        equipment_name="Test Mixer",
        equipment_type="Mixer",
        location="Production",
        capacity=100,
        capacity_unit="L",
        status="Operational",
        maintenance_status="Up to Date",
        last_maintenance=now,
        next_maintenance=None,
        utilization_percent=25,
        assigned_reactor=None,
        manufacturer="Test Manufacturer",
        serial_number="SN-007",
        notes=None,
        created_at=now,
        updated_at=now,
    )


def mock_equipment_db(equipment=None):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = equipment
    return db


def test_create_equipment_success_audits_and_commits():
    db = mock_equipment_db()
    payload = CreateEquipmentRequest(
        equipment_code="EQ-TEST-CREATE",
        equipment_name="Test Mixer",
        equipment_type="Mixer",
    )

    with patch("app.equipment.write_equipment_audit") as audit:
        result = create_equipment(
            payload=payload, db=db, identity=TEST_IDENTITY
        )

    assert result.equipment_code == "EQ-TEST-CREATE"
    audit.assert_called_once()
    assert audit.call_args.kwargs["action_code"] == "INSERT"
    db.flush.assert_called_once()
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(result)
    db.rollback.assert_not_called()


def test_update_equipment_success_audits_and_commits():
    equipment = make_equipment()
    db = mock_equipment_db(equipment)
    payload = UpdateEquipmentRequest(equipment_name="Updated Mixer")

    with patch("app.equipment.write_equipment_audit") as audit:
        result = update_equipment(
            equipment_id=7,
            payload=payload,
            db=db,
            identity=TEST_IDENTITY,
        )

    assert result.equipment_name == "Updated Mixer"
    audit.assert_called_once()
    assert audit.call_args.kwargs["action_code"] == "UPDATE"
    assert audit.call_args.kwargs["changed_fields"] == ["equipment_name"]
    db.commit.assert_called_once()
    db.rollback.assert_not_called()


def test_update_equipment_rolls_back_when_audit_fails():
    equipment = make_equipment()
    db = mock_equipment_db(equipment)
    payload = UpdateEquipmentRequest(equipment_name="Updated Mixer")

    with patch(
        "app.equipment.write_equipment_audit",
        side_effect=RuntimeError("Simulated audit failure"),
    ):
        with pytest.raises(RuntimeError, match="Simulated audit failure"):
            update_equipment(
                equipment_id=7,
                payload=payload,
                db=db,
                identity=TEST_IDENTITY,
            )

    db.flush.assert_called_once()
    db.rollback.assert_called_once()
    db.commit.assert_not_called()


def test_status_change_success_audits_and_commits():
    equipment = make_equipment()
    db = mock_equipment_db(equipment)

    with patch("app.equipment.write_equipment_audit") as audit:
        result = update_equipment_status(
            equipment_id=7,
            status="Under Maintenance",
            db=db,
            identity=TEST_IDENTITY,
        )

    assert result.status == "Under Maintenance"
    audit.assert_called_once()
    assert audit.call_args.kwargs["action_code"] == "UPDATE"
    assert audit.call_args.kwargs["changed_fields"] == ["status"]
    db.commit.assert_called_once()
    db.rollback.assert_not_called()


def test_status_change_rolls_back_when_audit_fails():
    equipment = make_equipment()
    db = mock_equipment_db(equipment)

    with patch(
        "app.equipment.write_equipment_audit",
        side_effect=RuntimeError("Simulated audit failure"),
    ):
        with pytest.raises(RuntimeError, match="Simulated audit failure"):
            update_equipment_status(
                equipment_id=7,
                status="Offline",
                db=db,
                identity=TEST_IDENTITY,
            )

    db.flush.assert_called_once()
    db.rollback.assert_called_once()
    db.commit.assert_not_called()


def test_delete_equipment_success_audits_and_commits():
    equipment = make_equipment()
    db = mock_equipment_db(equipment)

    with patch("app.equipment.write_equipment_audit") as audit:
        result = delete_equipment(
            equipment_id=7,
            db=db,
            identity=TEST_IDENTITY,
        )

    assert result["message"] == "Equipment deleted successfully"
    audit.assert_called_once()
    assert audit.call_args.kwargs["action_code"] == "DELETE"
    db.delete.assert_called_once_with(equipment)
    db.commit.assert_called_once()
    db.rollback.assert_not_called()


def test_delete_equipment_rolls_back_when_audit_fails():
    equipment = make_equipment()
    db = mock_equipment_db(equipment)

    with patch(
        "app.equipment.write_equipment_audit",
        side_effect=RuntimeError("Simulated audit failure"),
    ):
        with pytest.raises(RuntimeError, match="Simulated audit failure"):
            delete_equipment(
                equipment_id=7,
                db=db,
                identity=TEST_IDENTITY,
            )

    db.rollback.assert_called_once()
    db.commit.assert_not_called()
    db.delete.assert_not_called()

from app.equipment import (
    create_equipment,
    update_equipment,
    update_equipment_status,
    delete_equipment,
)
from app.schemas import CreateEquipmentRequest, UpdateEquipmentRequest


TEST_IDENTITY = {"user_id": "0a4d2e47-2693-4ef2-af9e-22a72bae913d"}


def make_equipment():
    now = datetime(2026, 10, 16, 10, 30, tzinfo=timezone.utc)
    return SimpleNamespace(
        id=7,
        equipment_code="EQ-TEST-007",
        equipment_name="Test Mixer",
        equipment_type="Mixer",
        location="Production",
        capacity=100,
        capacity_unit="L",
        status="Operational",
        maintenance_status="Up to Date",
        last_maintenance=now,
        next_maintenance=None,
        utilization_percent=25,
        assigned_reactor=None,
        manufacturer="Test Manufacturer",
        serial_number="SN-007",
        notes=None,
        created_at=now,
        updated_at=now,
    )


def mock_equipment_db(equipment=None):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = equipment
    return db


def test_create_equipment_success_audits_and_commits():
    db = mock_equipment_db()
    payload = CreateEquipmentRequest(
        equipment_code="EQ-TEST-CREATE",
        equipment_name="Test Mixer",
        equipment_type="Mixer",
    )

    with patch("app.equipment.write_equipment_audit") as audit:
        result = create_equipment(
            payload=payload, db=db, identity=TEST_IDENTITY
        )

    assert result.equipment_code == "EQ-TEST-CREATE"
    audit.assert_called_once()
    assert audit.call_args.kwargs["action_code"] == "INSERT"
    db.flush.assert_called_once()
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(result)
    db.rollback.assert_not_called()


def test_update_equipment_success_audits_and_commits():
    equipment = make_equipment()
    db = mock_equipment_db(equipment)
    payload = UpdateEquipmentRequest(equipment_name="Updated Mixer")

    with patch("app.equipment.write_equipment_audit") as audit:
        result = update_equipment(
            equipment_id=7,
            payload=payload,
            db=db,
            identity=TEST_IDENTITY,
        )

    assert result.equipment_name == "Updated Mixer"
    audit.assert_called_once()
    assert audit.call_args.kwargs["action_code"] == "UPDATE"
    assert audit.call_args.kwargs["changed_fields"] == ["equipment_name"]
    db.commit.assert_called_once()
    db.rollback.assert_not_called()


def test_update_equipment_rolls_back_when_audit_fails():
    equipment = make_equipment()
    db = mock_equipment_db(equipment)
    payload = UpdateEquipmentRequest(equipment_name="Updated Mixer")

    with patch(
        "app.equipment.write_equipment_audit",
        side_effect=RuntimeError("Simulated audit failure"),
    ):
        with pytest.raises(RuntimeError, match="Simulated audit failure"):
            update_equipment(
                equipment_id=7,
                payload=payload,
                db=db,
                identity=TEST_IDENTITY,
            )

    db.flush.assert_called_once()
    db.rollback.assert_called_once()
    db.commit.assert_not_called()


def test_status_change_success_audits_and_commits():
    equipment = make_equipment()
    db = mock_equipment_db(equipment)

    with patch("app.equipment.write_equipment_audit") as audit:
        result = update_equipment_status(
            equipment_id=7,
            status="Under Maintenance",
            db=db,
            identity=TEST_IDENTITY,
        )

    assert result.status == "Under Maintenance"
    audit.assert_called_once()
    assert audit.call_args.kwargs["action_code"] == "UPDATE"
    assert audit.call_args.kwargs["changed_fields"] == ["status"]
    db.commit.assert_called_once()
    db.rollback.assert_not_called()


def test_status_change_rolls_back_when_audit_fails():
    equipment = make_equipment()
    db = mock_equipment_db(equipment)

    with patch(
        "app.equipment.write_equipment_audit",
        side_effect=RuntimeError("Simulated audit failure"),
    ):
        with pytest.raises(RuntimeError, match="Simulated audit failure"):
            update_equipment_status(
                equipment_id=7,
                status="Offline",
                db=db,
                identity=TEST_IDENTITY,
            )

    db.flush.assert_called_once()
    db.rollback.assert_called_once()
    db.commit.assert_not_called()


def test_delete_equipment_success_audits_and_commits():
    equipment = make_equipment()
    db = mock_equipment_db(equipment)

    with patch("app.equipment.write_equipment_audit") as audit:
        result = delete_equipment(
            equipment_id=7,
            db=db,
            identity=TEST_IDENTITY,
        )

    assert result["message"] == "Equipment deleted successfully"
    audit.assert_called_once()
    assert audit.call_args.kwargs["action_code"] == "DELETE"
    db.delete.assert_called_once_with(equipment)
    db.commit.assert_called_once()
    db.rollback.assert_not_called()


def test_delete_equipment_rolls_back_when_audit_fails():
    equipment = make_equipment()
    db = mock_equipment_db(equipment)

    with patch(
        "app.equipment.write_equipment_audit",
        side_effect=RuntimeError("Simulated audit failure"),
    ):
        with pytest.raises(RuntimeError, match="Simulated audit failure"):
            delete_equipment(
                equipment_id=7,
                db=db,
                identity=TEST_IDENTITY,
            )

    db.rollback.assert_called_once()
    db.commit.assert_not_called()
    db.delete.assert_not_called()

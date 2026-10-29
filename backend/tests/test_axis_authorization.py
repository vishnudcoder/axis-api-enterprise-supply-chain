from unittest.mock import MagicMock

from app.axis_authorization import has_axis_permission


def test_existing_grant_is_allowed():
    db = MagicMock()
    db.execute.return_value.scalar_one.return_value = True

    assert has_axis_permission(
        db, "ASSET", "ASSET_EQUIPMENT", "can_create"
    ) is True

    params = db.execute.call_args.args[1]
    assert params["role_code"] == "ASSET"
    assert params["screen_code"] == "ASSET_EQUIPMENT"
    assert params["action_code"] == "CREATE"


def test_missing_grant_is_denied():
    db = MagicMock()
    db.execute.return_value.scalar_one.return_value = False

    assert has_axis_permission(
        db, "ASSET", "ASSET_EQUIPMENT", "can_delete"
    ) is False


def test_unknown_action_is_denied_without_database_query():
    db = MagicMock()

    assert has_axis_permission(
        db, "ASSET", "ASSET_EQUIPMENT", "can_export"
    ) is False

    db.execute.assert_not_called()


def test_missing_role_or_screen_is_denied():
    db = MagicMock()

    assert has_axis_permission(
        db, "", "ASSET_EQUIPMENT", "can_view"
    ) is False
    assert has_axis_permission(
        db, "ASSET", "", "can_view"
    ) is False

    db.execute.assert_not_called()

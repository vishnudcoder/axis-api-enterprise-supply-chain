from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.supabase_authorization import require_axis_permission


def test_axis_permission_dependency_allows_existing_grant():
    identity = {"role_code": "ASSET"}
    db = MagicMock()
    dependency = require_axis_permission("ASSET_EQUIPMENT", "can_create")

    with patch(
        "app.supabase_authorization.has_axis_permission",
        return_value=True,
    ) as permission_check:
        result = dependency(identity=identity, db=db)

    assert result is identity
    permission_check.assert_called_once_with(
        db=db,
        role_code="ASSET",
        screen_code="ASSET_EQUIPMENT",
        action="can_create",
    )


def test_axis_permission_dependency_denies_missing_grant():
    identity = {"role_code": "ASSET"}
    db = MagicMock()
    dependency = require_axis_permission("ASSET_EQUIPMENT", "can_delete")

    with patch(
        "app.supabase_authorization.has_axis_permission",
        return_value=False,
    ):
        with pytest.raises(HTTPException) as exc_info:
            dependency(identity=identity, db=db)

    assert exc_info.value.status_code == 403

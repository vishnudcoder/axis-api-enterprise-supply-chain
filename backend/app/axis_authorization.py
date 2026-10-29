from sqlalchemy import text


ACTION_MAP = {
    "can_view": "VIEW",
    "can_create": "CREATE",
    "can_edit": "UPDATE",
    "can_delete": "DELETE",
    "can_approve": "APPROVE",
}


def has_axis_permission(db, role_code: str, screen_code: str, action: str) -> bool:
    """
    Check an existing active AXIS role grant.
    Deny by default; never creates or changes permissions.
    """
    action_code = ACTION_MAP.get(action.lower()) if action.lower().startswith("can_") else action.upper()
    if not action_code or not role_code or not screen_code:
        return False

    result = db.execute(
        text("""
            SELECT EXISTS (
                SELECT 1
                FROM security.role AS r
                JOIN security.role_screen AS rs
                  ON rs.role_id = r.role_id
                JOIN security.screen AS s
                  ON s.screen_id = rs.screen_id
                JOIN security.screen_action AS sa
                  ON sa.screen_id = s.screen_id
                JOIN security.permission AS p
                  ON p.permission_id = sa.permission_id
                JOIN security.role_permission AS rp
                  ON rp.role_id = r.role_id
                 AND rp.permission_id = p.permission_id
                WHERE r.role_code = :role_code
                  AND r.is_active = TRUE
                  AND rs.is_active = TRUE
                  AND rs.access_mode = 'ALLOW'
                  AND s.screen_code = :screen_code
                  AND s.is_active = TRUE
                  AND sa.is_active = TRUE
                  AND p.is_active = TRUE
                  AND p.action_code = :action_code
                  AND rp.is_active = TRUE
            )
        """),
        {
            "role_code": role_code,
            "screen_code": screen_code,
            "action_code": action_code,
        },
    ).scalar_one()

    return bool(result)



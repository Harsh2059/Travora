"""
One-off migration: add missing columns to recovery_histories.
"""
from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Get existing columns
    cols = [r[1] for r in conn.execute(text("PRAGMA table_info(recovery_histories)")).fetchall()]
    print("Existing columns:", cols)

    if "plan_details" not in cols:
        conn.execute(text("ALTER TABLE recovery_histories ADD COLUMN plan_details JSON"))
        print("Added: plan_details")

    if "status" not in cols:
        conn.execute(text("ALTER TABLE recovery_histories ADD COLUMN status TEXT DEFAULT 'COMPLETED'"))
        print("Added: status")

    conn.commit()
    
    # Verify
    cols_after = [r[1] for r in conn.execute(text("PRAGMA table_info(recovery_histories)")).fetchall()]
    print("Columns after migration:", cols_after)
    print("Migration complete.")

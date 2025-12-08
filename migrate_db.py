import sqlite3
import os

DB_FILE = "app.db"

def migrate():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Projects Table Migration
    project_columns = [
        ("brand_vibe", "VARCHAR"),
        ("brand_lighting", "VARCHAR"),
        ("brand_colors", "VARCHAR"),
        ("brand_subject", "VARCHAR"),
        ("project_vibe", "VARCHAR"),
        ("project_lighting", "VARCHAR"),
        ("project_colors", "VARCHAR"),
        ("project_subject", "VARCHAR")
    ]

    print("Checking projects table...")
    cursor.execute("PRAGMA table_info(projects)")
    existing_project_columns = [row[1] for row in cursor.fetchall()]

    for col_name, col_type in project_columns:
        if col_name not in existing_project_columns:
            print(f"Adding column to projects: {col_name}")
            try:
                cursor.execute(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type}")
            except sqlite3.OperationalError as e:
                print(f"Error adding column {col_name}: {e}")
        else:
            print(f"Column {col_name} already exists in projects.")

    # Assets Table Migration
    asset_columns = [
        ("model_type", "VARCHAR"),
        ("context_version", "VARCHAR")
    ]

    print("Checking assets table...")
    cursor.execute("PRAGMA table_info(assets)")
    existing_asset_columns = [row[1] for row in cursor.fetchall()]

    for col_name, col_type in asset_columns:
        if col_name not in existing_asset_columns:
            print(f"Adding column to assets: {col_name}")
            try:
                cursor.execute(f"ALTER TABLE assets ADD COLUMN {col_name} {col_type}")
            except sqlite3.OperationalError as e:
                print(f"Error adding column {col_name}: {e}")
        else:
            print(f"Column {col_name} already exists in assets.")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()

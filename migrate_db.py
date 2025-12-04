import sqlite3
import os

DB_FILE = "app.db"

def migrate():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    new_columns = [
        ("brand_vibe", "VARCHAR"),
        ("brand_lighting", "VARCHAR"),
        ("brand_colors", "VARCHAR"),
        ("brand_subject", "VARCHAR"),
        ("project_vibe", "VARCHAR"),
        ("project_lighting", "VARCHAR"),
        ("project_colors", "VARCHAR"),
        ("project_subject", "VARCHAR")
    ]

    print("Checking for missing columns...")
    
    # Get existing columns
    cursor.execute("PRAGMA table_info(projects)")
    existing_columns = [row[1] for row in cursor.fetchall()]

    for col_name, col_type in new_columns:
        if col_name not in existing_columns:
            print(f"Adding column: {col_name}")
            try:
                cursor.execute(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type}")
            except sqlite3.OperationalError as e:
                print(f"Error adding column {col_name}: {e}")
        else:
            print(f"Column {col_name} already exists.")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()

import os
import sqlite3

from server.database import DB_PATH, get_db, init_db, is_remote_database_configured


def _quote_identifier(identifier):
    return '"' + identifier.replace('"', '""') + '"'


def migrate_database(source_path=DB_PATH):
    if not is_remote_database_configured():
        raise RuntimeError(
            "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before migrating."
        )
    if not os.path.isfile(source_path):
        raise FileNotFoundError(f"Local database not found: {source_path}")

    init_db()
    source = sqlite3.connect(source_path)
    source.row_factory = sqlite3.Row
    try:
        tables = [
            row["name"]
            for row in source.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
            )
        ]
        tables.sort(key=lambda name: (name not in ("users", "participants"), name))

        with get_db() as destination:
            for table in tables:
                quoted_table = _quote_identifier(table)
                columns = [
                    row["name"]
                    for row in source.execute(
                        f"PRAGMA table_info({quoted_table})"
                    )
                ]
                if not columns:
                    continue

                quoted_columns = ", ".join(
                    _quote_identifier(column) for column in columns
                )
                placeholders = ", ".join("?" for _ in columns)
                insert = (
                    f"INSERT OR IGNORE INTO {quoted_table} "
                    f"({quoted_columns}) VALUES ({placeholders})"
                )
                for row in source.execute(f"SELECT {quoted_columns} FROM {quoted_table}"):
                    destination.execute(insert, tuple(row))

                print(f"Migrated table: {table}")
    finally:
        source.close()


if __name__ == "__main__":
    migrate_database()

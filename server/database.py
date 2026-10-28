import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.environ.get(
    "DATABASE_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ki23_eval.db"),
)


def is_remote_database_configured():
    return bool(os.environ.get("TURSO_DATABASE_URL"))


def _connect_database():
    database_url = os.environ.get("TURSO_DATABASE_URL")
    if database_url:
        auth_token = os.environ.get("TURSO_AUTH_TOKEN")
        if not auth_token:
            raise RuntimeError("TURSO_AUTH_TOKEN must be configured when using Turso.")
        try:
            import turso_serverless
        except ImportError as exc:
            raise RuntimeError(
                "The turso-serverless package is required for the configured Turso database."
            ) from exc
        return turso_serverless.connect(database_url, auth_token=auth_token)

    if os.environ.get("VERCEL"):
        raise RuntimeError(
            "A persistent database is required on Vercel. Configure "
            "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the Vercel project settings."
        )

    return sqlite3.connect(DB_PATH, check_same_thread=False)


def _row_as_dict(cursor, row):
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    if hasattr(row, "keys"):
        return {key: row[key] for key in row.keys()}

    columns = cursor.description or ()
    names = [
        column.name if hasattr(column, "name") else column[0]
        for column in columns
    ]
    return dict(zip(names, row))


class _Cursor:
    def __init__(self, cursor):
        self._cursor = cursor

    @property
    def description(self):
        return self._cursor.description

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def lastrowid(self):
        return self._cursor.lastrowid

    def execute(self, query, parameters=()):
        self._cursor.execute(query, parameters)
        return self

    def executemany(self, query, parameters):
        self._cursor.executemany(query, parameters)
        return self

    def fetchone(self):
        return _row_as_dict(self._cursor, self._cursor.fetchone())

    def fetchall(self):
        return [_row_as_dict(self._cursor, row) for row in self._cursor.fetchall()]

    def __iter__(self):
        for row in self._cursor:
            yield _row_as_dict(self._cursor, row)


class _Connection:
    def __init__(self, connection):
        self._connection = connection

    def cursor(self):
        return _Cursor(self._connection.cursor())

    def execute(self, query, parameters=()):
        return _Cursor(self._connection.execute(query, parameters))

    def commit(self):
        self._connection.commit()

    def rollback(self):
        self._connection.rollback()

    def close(self):
        self._connection.close()

@contextmanager
def get_db():
    raw_conn = _connect_database()
    conn = _Connection(raw_conn)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Users table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL, -- supervisor, hrd_kepala, hrd_profesi, hrd_kelompok, hrd_all, wali_kelas, pjk, peserta
            assigned_group TEXT, -- e.g. 'Kelompok 1' for PJK
            assigned_profession TEXT, -- e.g. 'Reporter' or 'ALL' for Wali Kelas
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 2. Participants table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            normalized_name TEXT NOT NULL,
            profession TEXT NOT NULL, -- Ilustrator, Fotografer, Layouter, Marcomm, Reporter
            tabmin_group TEXT NOT NULL, -- Kelompok 1 to Kelompok 6
            pjk_name TEXT,
            whatsapp_group TEXT,
            jurusan TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, tabmin_group)
        );
        """)

        # Check and migrate columns if tables already exist
        cursor.execute("PRAGMA table_info(participants)")
        existing_cols = [col["name"] for col in cursor.fetchall()]
        if "email" in existing_cols:
            cursor.execute("ALTER TABLE participants DROP COLUMN email")
            print("Migrated: Removed participant email data.")
        if "password" not in existing_cols:
            cursor.execute("ALTER TABLE participants ADD COLUMN password TEXT")
            print("Migrated: Added 'password' column to participants table.")
        if "password_hash" not in existing_cols:
            cursor.execute("ALTER TABLE participants ADD COLUMN password_hash TEXT")
            print("Migrated: Added 'password_hash' column to participants table.")
        if "jurusan" not in existing_cols:
            cursor.execute("ALTER TABLE participants ADD COLUMN jurusan TEXT")
            print("Migrated: Added 'jurusan' column to participants table.")

        cursor.execute("PRAGMA table_info(users)")
        existing_user_cols = [col["name"] for col in cursor.fetchall()]
        if "password" not in existing_user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN password TEXT")
            print("Migrated: Added 'password' column to users table.")


        # 3. Tabmin Member Evaluations (3 general indicators)
        # Evaluators: hrd, pjk, peer
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tabmin_member_evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
            evaluator_role TEXT NOT NULL, -- 'hrd', 'pjk', 'peer'
            evaluator_id INTEGER, -- optional user ID if logged in
            evaluator_name TEXT NOT NULL,
            tabmin_group TEXT NOT NULL,
            score_kehadiran INTEGER NOT NULL CHECK(score_kehadiran BETWEEN 1 AND 5),
            score_partisipasi INTEGER NOT NULL CHECK(score_partisipasi BETWEEN 1 AND 5),
            score_sikap INTEGER NOT NULL CHECK(score_sikap BETWEEN 1 AND 5),
            notes TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(participant_id, evaluator_role, evaluator_name)
        );
        """)

        # 4. Tabmin Product Evaluations (5 profession aspects for Kelompok 1-6)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tabmin_product_evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tabmin_group TEXT NOT NULL,
            evaluator_id INTEGER,
            evaluator_name TEXT NOT NULL,
            score_reporter INTEGER NOT NULL CHECK(score_reporter BETWEEN 1 AND 5),
            score_fotografer INTEGER NOT NULL CHECK(score_fotografer BETWEEN 1 AND 5),
            score_ilustrator INTEGER NOT NULL CHECK(score_ilustrator BETWEEN 1 AND 5),
            score_layouter INTEGER NOT NULL CHECK(score_layouter BETWEEN 1 AND 5),
            score_marcomm INTEGER NOT NULL CHECK(score_marcomm BETWEEN 1 AND 5),
            notes TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tabmin_group, evaluator_name)
        );
        """)

        # 5. Profesi General Evaluations (Keprof 1, 2, 3) - Filled by HRD Profesi
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS profesi_general_evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
            keprof_session INTEGER NOT NULL CHECK(keprof_session IN (1, 2, 3)),
            evaluator_id INTEGER,
            evaluator_name TEXT NOT NULL,
            score_kehadiran INTEGER NOT NULL CHECK(score_kehadiran BETWEEN 1 AND 5),
            score_partisipasi INTEGER NOT NULL CHECK(score_partisipasi BETWEEN 1 AND 5),
            score_sikap INTEGER NOT NULL CHECK(score_sikap BETWEEN 1 AND 5),
            is_absen INTEGER DEFAULT 0, -- 1 = Absent (requires tugas pengganti)
            notes TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(participant_id, keprof_session)
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS profesi_attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
            keprof_session INTEGER NOT NULL CHECK(keprof_session IN (1, 2, 3)),
            is_absen INTEGER NOT NULL CHECK(is_absen IN (0, 1)),
            evaluator_id INTEGER,
            evaluator_name TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(participant_id, keprof_session)
        );
        """)
        cursor.execute("""
            INSERT OR IGNORE INTO profesi_attendance
                (participant_id, keprof_session, is_absen, evaluator_id, evaluator_name, updated_at)
            SELECT participant_id, keprof_session, is_absen, evaluator_id, evaluator_name, updated_at
            FROM profesi_general_evaluations
        """)
        cursor.execute("""
            DELETE FROM profesi_general_evaluations
            WHERE notes = 'Status kehadiran disetel.'
               OR is_absen = 1
        """)

        # 6. Profesi Task Evaluations (Keprof 1 and 2)
        # Evaluated by HRD Profesi (score_teknis) and Wali Kelas (score_isi)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS profesi_task_evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
            keprof_session INTEGER NOT NULL CHECK(keprof_session IN (1, 2)),
            is_replacement INTEGER DEFAULT 0, -- 0 = Tugas Reguler, 1 = Tugas Pengganti
            score_teknis INTEGER CHECK(score_teknis BETWEEN 1 AND 5), -- by HRD Profesi
            hrd_evaluator_name TEXT,
            score_isi INTEGER CHECK(score_isi BETWEEN 1 AND 5), -- by Wali Kelas
            wali_evaluator_name TEXT,
            task_notes TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(participant_id, keprof_session, is_replacement)
        );
        """)

        # 7. Activity Log
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            role TEXT,
            action TEXT NOT NULL,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_token TEXT PRIMARY KEY,
            user_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """)
        
        print("Database schema successfully initialized.")

import argparse

from server.database import get_db


SCORE_TABLES = (
    "tabmin_member_evaluations",
    "tabmin_product_evaluations",
    "profesi_general_evaluations",
    "profesi_task_evaluations",
)


def reset_evaluations(confirm=False):
    with get_db() as conn:
        cursor = conn.cursor()
        counts = {}
        for table in SCORE_TABLES:
            cursor.execute(f"SELECT COUNT(*) AS count FROM {table}")
            counts[table] = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) AS count FROM profesi_attendance")
        attendance_count = cursor.fetchone()["count"]

        if confirm:
            for table in SCORE_TABLES:
                cursor.execute(f"DELETE FROM {table}")

        cursor.execute("SELECT COUNT(*) AS count FROM profesi_attendance")
        remaining_attendance = cursor.fetchone()["count"]

    action = "Dihapus" if confirm else "Akan dihapus (simulasi)"
    print(f"{action} nilai evaluasi berikut:")
    for table, count in counts.items():
        print(f"- {table}: {count}")
    print(
        "Absensi profesi dipertahankan: "
        f"{remaining_attendance} status (sebelum reset: {attendance_count})."
    )
    return counts


def main():
    parser = argparse.ArgumentParser(
        description="Kosongkan semua nilai evaluasi tanpa menghapus absensi profesi."
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Jalankan penghapusan nilai. Tanpa opsi ini hanya menampilkan simulasi.",
    )
    args = parser.parse_args()
    reset_evaluations(confirm=args.confirm)


if __name__ == "__main__":
    main()

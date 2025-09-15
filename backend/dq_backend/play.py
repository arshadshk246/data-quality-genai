from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool
from utils import db_source, db_rules

def add_row_numbers(db, table_name):
    # Add column 'row_num' if it doesn't exist
    alter_query = f"ALTER TABLE {table_name} ADD COLUMN row_num INTEGER"
    try:
        db.run(alter_query)
    except Exception as e:
        # Ignore error if column already exists
        if "duplicate column name" not in str(e).lower():
            raise e

    # Update row_num with sequential numbers based on rowid
    update_query = f"""
        UPDATE {table_name}
        SET row_num = (
            SELECT COUNT(*) FROM {table_name} t2 WHERE t2.rowid <= {table_name}.rowid
        )
    """
    db.run(update_query)


# add_row_numbers(db_source, "conventional_power_plants_DE")

def delete_all_rows(db, table_name):
    query = f"DELETE FROM {table_name}"
    db.run(query)

delete_all_rows(db_rules, "rule_storage")
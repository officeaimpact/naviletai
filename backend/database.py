"""
Database stub — graceful degradation when PostgreSQL is not available.
All handlers check is_db_available() before using the database.
"""


def is_db_available():
    return False


class _NullCtx:
    def __enter__(self):
        return None

    def __exit__(self, *a):
        pass


def get_db():
    return _NullCtx()

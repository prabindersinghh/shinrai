import os

# Some Windows machines block SQLAlchemy's compiled extensions (Application Control); pure Python is fine here.
os.environ.setdefault("DISABLE_SQLALCHEMY_CEXT_RUNTIME", "1")

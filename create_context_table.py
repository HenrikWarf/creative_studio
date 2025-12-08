from backend.database import engine, Base
from backend.models import ContextVersion

# Create the table
Base.metadata.create_all(bind=engine)
print("ContextVersion table created.")

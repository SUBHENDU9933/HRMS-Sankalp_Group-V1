"""One-shot script: apply /app/migrations/001_initial.sql to Supabase Postgres."""
import os
import re
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

load_dotenv(Path(__file__).parent / ".env")

# psycopg2 needs raw URL; convert URL-encoded password
url = os.environ["DATABASE_URL"]
sql_path = Path(__file__).parent.parent / "migrations" / "001_initial.sql"
sql = sql_path.read_text()

print(f"Connecting to: {re.sub(r':[^:@]+@', ':****@', url)}")
conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()
cur.execute(sql)
print("Migration applied OK.")
cur.close()
conn.close()

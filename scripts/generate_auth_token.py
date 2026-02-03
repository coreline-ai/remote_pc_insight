
from datetime import timedelta
from app.core.security import create_jwt_token
from app.core.config import settings

def generate_test_token():
    # User ID must match the seeded user in setup_e2e_db.py ('test-user-id')
    user_id = "test-user-id"
    access_token_expires = timedelta(minutes=60*24) # 24 hours
    token = create_jwt_token(
        data={"sub": user_id},
        expires_delta=access_token_expires,
    )
    print(token)

if __name__ == "__main__":
    generate_test_token()

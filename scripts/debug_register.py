
import asyncio
import httpx
import uuid

async def debug_register():
    # Use a random email to avoid collision
    random_str = str(uuid.uuid4())[:8]
    email = f"test_{random_str}@example.com"
    password = "password123"
    
    url = "http://localhost:8001/v1/auth/register"
    print(f"Requesting: {url} with {email}")
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json={"email": email, "password": password})
            print(f"Status: {resp.status_code}")
            if resp.status_code in (200, 201):
                print("Response:", resp.json())
            else:
                print("Error Response:", resp.text)
        except Exception as e:
            print(f"Connection Error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_register())

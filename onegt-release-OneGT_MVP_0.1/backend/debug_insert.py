import asyncio
import httpx
import json

BASE = 'https://api-careerpage.guhatek.com'
KEY = 'guhatek-job-applicant'

async def test_insert():
    async with httpx.AsyncClient(verify=False) as c:
        # Get token
        r = await c.get(f'{BASE}/api/token', headers={'x-api-key': KEY})
        token = r.json()['token']
        print(f"Token: {token[:20]}...")
        
        # Test 1: Multipart form-data with applicationData JSON string
        app_data = {
            "fullName": "Test User From Python",
            "email": "testpython@example.com",
            "contactNumber": "9999999999",
            "interestedPosition": "QA",
            "status": "Applied",
            "currentRole": "Tester",
            "totalExperience": 2,
            "currentCTC": 500000,
            "expectedCTC": 600000,
        }
        
        files = {"file": ("test.txt", b"dummy resume content")}
        data = {"applicationData": json.dumps(app_data)}
        
        print("\nSending POST /api/applications ...")
        r2 = await c.post(
            f"{BASE}/api/applications",
            headers={"Authorization": f"Bearer {token}"},
            files=files,
            data=data
        )
        print(f"Status: {r2.status_code}")
        print(f"Response: {r2.text}")

asyncio.run(test_insert())

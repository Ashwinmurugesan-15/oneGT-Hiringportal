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
        
        # Test exact frontend data that failed
        app_data = {
          "fullName": "Test John",
          "email": "john@test.com",
          "contactNumber": "9999999999",
          "interestedPosition": "Unknown",
          "status": "Applied",
          "currentRole": "",
          "currentOrganization": "",
          "totalExperience": 0,
          "currentLocation": "",
          "locationPreference": "",
          "currentCTC": 0,
          "expectedCTC": 0,
          "noticePeriod": "",
          "currentlyInNotice": False,
          "immediateJoiner": False,
          "linkedinProfile": "",
          "otherOffersInHand": False,
          "certifications": [],
          "skills": [],
          "referredBy": "",
        }
        
        files = {"file": ("test.txt", b"dummy resume content")}
        data = {"applicationData": json.dumps(app_data)}
        
        print("\nSending POST /api/applications with frontend data format...")
        r2 = await c.post(
            f"{BASE}/api/applications",
            headers={"Authorization": f"Bearer {token}"},
            files=files,
            data=data
        )
        print(f"Status: {r2.status_code}")
        print(f"Response: {r2.text}")

asyncio.run(test_insert())

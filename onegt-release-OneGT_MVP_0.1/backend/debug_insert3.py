import asyncio
import httpx
import json

BASE = 'https://api-careerpage.guhatek.com'
KEY = 'guhatek-job-applicant'

async def test_insert():
    async with httpx.AsyncClient(verify=False) as c:
        r = await c.get(f'{BASE}/api/token', headers={'x-api-key': KEY})
        token = r.json()['token']
        
        # This is exactly what Candidates.tsx produces line 511-532
        app_data = {"fullName":"testing","email":"abc@test.com","contactNumber":"9999999999","interestedPosition":"Backend Developer","status":"Applied","currentRole":"SE","currentOrganization":"Comp","totalExperience":3,"currentLocation":"Ban","locationPreference":"Ban","currentCTC":0,"expectedCTC":0,"noticePeriod":"30","currentlyInNotice":False,"immediateJoiner":False,"linkedinProfile":"","otherOffersInHand":False,"certifications":[],"skills":[],"referredBy":""}
        
        files = {"file": ("test.txt", b"dummy resume")}
        data = {"applicationData": json.dumps(app_data)}
        
        r2 = await c.post(
            f"{BASE}/api/applications",
            headers={"Authorization": f"Bearer {token}"},
            files=files,
            data=data
        )
        print(f"Status: {r2.status_code}")
        print(f"Response: {r2.text}")

asyncio.run(test_insert())

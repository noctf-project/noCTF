import asyncio
import base64
import os
import httpx
import json
import random
import string
import yaml
from typing import Dict, List, Any, Optional, Union
from pydantic import BaseModel, Field


class CTFClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.token = None
        self.client = httpx.AsyncClient(base_url=base_url, timeout=30.0 )

    async def close(self):
        await self.client.aclose()

    async def _request(
        self, 
        method: str, 
        path: str, 
        data: Optional[Dict[str, Any]] = None, 
        params: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Any]] = None,
        auth: bool = True
    ) -> Dict[str, Any]:
        headers = {}
        if auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        response = await self.client.request(
            method=method,
            url=path,
            json=data,
            params=params,
            files=files,
            headers=headers
        )

        
        response.raise_for_status()
        
        if response.status_code == 204 or not response.content:
            return {}
        
        return response.json()

    async def register_user(self, email: str, name: str, password: str) -> str:
        # Step 1: Initialize email authentication
        init_response = await self._request(
            "POST", 
            "/auth/email/init", 
            data={"email": email},
            auth=False
        )
        
        token = init_response.get("data", {}).get("token")
        if not token:
            raise Exception("Failed to get registration token")
        
        # Step 2: Complete registration
        register_response = await self._request(
            "POST",
            "/auth/register/finish",
            data={
                "token": token,
                "name": name,
                "email": email,
                "password": password
            },
            auth=False
        )
        
        self.token = register_response.get("data", {}).get("token")
        return self.token

    async def login(self, email: str, password: str) -> str:
        login_response = await self._request(
            "POST",
            "/auth/email/finish",
            data={"email": email, "password": password},
            auth=False
        )
        
        self.token = login_response.get("data", {}).get("token")
        return self.token

    async def create_team(self, name: str, division_id: int = 1) -> Dict[str, Any]:
        response = await self._request(
            "POST",
            "/teams",
            data={"name": name, "division_id": division_id, "tag_ids":[]}
        )
        return response.get("data", {})

    async def get_team(self) -> Dict[str, Any]:
        response = await self._request("GET", "/team")
        return response.get("data", {})

    async def get_user(self) -> Dict[str, Any]:
        response = await self._request("GET", "/user/me")
        return response.get("data", {})

    async def get_challenges(self) -> List[Dict[str, Any]]:
        response = await self._request("GET", "/challenges")
        return response.get("data", {}).get("challenges", [])

    async def get_challenge(self, challenge_id: int) -> Dict[str, Any]:
        response = await self._request("GET", f"/challenges/{challenge_id}")
        return response.get("data", {})

    async def solve_challenge(self, challenge_id: int, flag: str = "flag") -> str:
        response = await self._request(
            "POST", 
            f"/challenges/{challenge_id}/solves", 
            data={"data": flag}
        )
        return response.get("data", "")
    
    async def get_challenges_admin(self) -> List[Dict[str, Any]]:
        response = await self._request("GET", "/admin/challenges")
        return response.get("data", [])

    async def get_challenge_admin(self, challenge_id: int) -> Dict[str, Any]:
        response = await self._request("GET", f"/admin/challenges/{challenge_id}")
        return response.get("data", {})

    async def create_challenge(self, challenge_data: Dict[str, Any]) -> Dict[str, Any]:
        response = await self._request(
            "POST",
            "/admin/challenges",
            data=challenge_data
        )
        return response.get("data", {})

    async def create_attachment(self, file_name: str, file_data: bytes) -> Dict[str, Any]:
        response = await self._request(
            "POST",
            "/admin/files",
            files={"file": (file_name, file_data)}
        )
        return response.get("data", {})

    async def update_challenge(self, challenge_id: int, challenge_data: Dict[str, Any]) -> Dict[str, Any]:
        response = await self._request(
            "PUT",
            f"/admin/challenges/{challenge_id}",
            data=challenge_data
        )
        return response.get("data", {})


class ChallengeConverter:
    @staticmethod
    def from_yaml(yaml_content: str) -> Dict[str, Any]:
        data = yaml.safe_load(yaml_content)
        
        # Build the challenge object for the API
        challenge = {
            "slug": data.get("id", ""),
            "title": data.get("name", ""),
            "description": data.get("description", ""),
            "tags": {
                "categories": data.get("category", "misc"),
                "difficulty": data.get("tags", ["medium"])[0] if data.get("tags") else "medium"
            },
            "hidden": False,
            "visible_at": None,
            "private_metadata": {
                "solve": {
                    "source": "flag",
                    "flag": [
                        {
                            "data": flag_data,
                            "strategy": "case_sensitive"
                        }
                        for flag_data in data.get("flags", [])
                    ],
                },
                "score": {
                    "params": {
                        "base": 100,
                        "top": 500,
                        "decay": 100,
                    },
                    "strategy": "core:quadratic",
                    "bonus": []
                },
                "files": []  
            }
        }
        
        return challenge


async def register_user_and_team(base_url: str, password: str = "Password123!") -> CTFClient:
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    username = f"user_{random_str}"
    team_name = f"team_{random_str}"
    email = f"{username}@example.com"
    
    client = CTFClient(base_url)
    await client.register_user(email, username, password)
    await client.create_team(team_name)
    
    return client


async def upload_challenge_from_yaml(client: CTFClient, yaml_content: str, files: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    challenge_data = ChallengeConverter.from_yaml(yaml_content)
    challenge_data["private_metadata"]["files"] = [{"id": file["id"], "is_attachment": True} for file in files] if files else []
    print(challenge_data)
    return await client.create_challenge(challenge_data)

async def upload_attachments_from_yaml(client: CTFClient, yaml_content: str, directory: str) -> List[Dict[str, Any]]:
    results = []
    attachments =  yaml.safe_load(yaml_content).get("files", [])
    for attachment in attachments:
        file_data = open(os.path.join(directory, attachment), "rb").read()
        result = await client.create_attachment(attachment, file_data)
        results.append(result)
    return results

async def mass_solve_challenges(client: CTFClient, num_challenges: Optional[int] = None) -> List[str]:
    challenges = await client.get_challenges()
    if num_challenges:
        challenges = challenges[:num_challenges]
    
    results = []
    for challenge in challenges:
        result = await client.solve_challenge(challenge["id"])
        results.append(f"Challenge {challenge['title']}: {result}")
    
    return results

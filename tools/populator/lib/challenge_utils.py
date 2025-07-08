import asyncio
import os
from typing import List, Dict, Any
from client import CTFClient, upload_challenge_from_yaml, upload_attachments_from_yaml, ChallengeConverter


async def upload_challenges_from_directory(
    client: CTFClient, 
    directory: str,
    upload_files: bool
) -> List[Dict[str, Any]]:
    """Upload all challenges from YAML files in a directory"""
    results = []
    
    yaml_files = [f for f in os.listdir(directory) if f.endswith(('.yml', '.yaml'))]
    
    for file_name in yaml_files:
        file_path = os.path.join(directory, file_name)
        challenge = await upload_challenge_from_file(client, file_path, upload_files)
        results.append(challenge)
    
    return results


async def upload_challenge_from_file(client: CTFClient, file_path: str, upload_files: bool) -> Dict[str, Any]:
    """Upload a single challenge from a YAML file"""
    try:
        with open(file_path, 'r') as f:
            yaml_content = f.read()
        
        files = None
        if upload_files:
            files = await upload_attachments_from_yaml(client, yaml_content, os.path.dirname(file_path))
        challenge = await upload_challenge_from_yaml(client, yaml_content, files)
        print(f"Uploaded challenge: {challenge.get('title')} (ID: {challenge.get('id')})")
        return {
            "file": file_path,
            "challenge_id": challenge.get("id"),
            "title": challenge.get("title"),
            "status": "uploaded"
        }
    except Exception as e:
        print(f"Failed to upload {file_path}: {str(e)}")
        return {
            "file": file_path,
            "status": "failed",
            "error": str(e)
        }


async def update_challenges_from_directory(
    client: CTFClient, 
    directory: str,
    upload_files: bool
) -> List[Dict[str, Any]]:
    """Update all challenges from YAML files in a directory"""
    results = []
    
    yaml_files = [f for f in os.listdir(directory) if f.endswith(('.yml', '.yaml'))]
    
    for file_name in yaml_files:
        file_path = os.path.join(directory, file_name)
        challenge = await update_challenge_from_file(client, file_path, upload_files)
        results.append(challenge)
    
    return results


async def get_existing_challenge_by_slug(client: CTFClient, slug: str) -> Dict[str, Any]:
    """Get an existing challenge by slug"""
    existing_challenge = None
    challenges = await client.get_challenges_admin()
    for challenge in challenges:
        if challenge.get("slug") == slug:
            existing_challenge = challenge
            break
    if not existing_challenge:
        raise Exception(f"Challenge with slug '{slug}' not found")
    challenge_id = existing_challenge.get("id")
    if challenge_id is None:
        raise Exception(f"Challenge {existing_challenge.get('title')} has no ID")
    existing_challenge_details = await client.get_challenge_admin(challenge_id)
    return existing_challenge_details

async def update_challenge_from_file(client: CTFClient, file_path: str, upload_files: bool) -> Dict[str, Any]:
    """Update a single challenge from a YAML file"""
    try:
        with open(file_path, 'r') as f:
            yaml_content = f.read()

        challenge_data = ChallengeConverter.from_yaml(yaml_content)
        print(challenge_data)
        slug = challenge_data.get("slug")
        if not slug:
            raise Exception("Challenge slug is required")   
        existing_challenge = await get_existing_challenge_by_slug(client, slug)
        challenge_data["version"] = existing_challenge.get("version")

        files = None
        if upload_files:
            files = await upload_attachments_from_yaml(client, yaml_content, os.path.dirname(file_path))
        else:
            files = existing_challenge.get("private_metadata", {}).get("files", [])
        
        # Get challenge data from YAML
        challenge_data["private_metadata"]["files"] = [{"id": file["id"], "is_attachment": True} for file in files] if files else []
        
        challenge_id = existing_challenge.get("id")
        if challenge_id is None:
            raise Exception(f"Challenge {existing_challenge.get('title')} has no ID")
        existing_challenge_details = await client.get_challenge_admin(challenge_id)
        challenge_data["version"] = existing_challenge_details.get("version")
        print(f"Updating existing challenge: {existing_challenge.get('title')} (ID: {challenge_id})")
        challenge = await client.update_challenge(challenge_id, challenge_data)
        
        print(f"Updated challenge: {challenge.get('title')} (ID: {challenge.get('id')})")
        return {
            "file": file_path,
            "challenge_id": challenge.get("id"),
            "title": challenge.get("title"),
            "status": "updated"
        }
    except Exception as e:
        print(f"Failed to update {file_path}: {str(e)}")
        return {
            "file": file_path,
            "status": "failed",
            "error": str(e)
        }


def print_results_summary(results: List[Dict[str, Any]], operation: str):
    """Print a summary of operation results"""
    success_count = sum(1 for r in results if r.get("status") in ["uploaded", "updated", "created"])
    failed_count = len(results) - success_count
    
    print(f"\n{operation.capitalize()} {success_count}/{len(results)} challenges successfully")
    if failed_count > 0:
        print(f"Failed: {failed_count}")
        for result in results:
            if result.get("status") == "failed":
                print(f"  - {result.get('file')}: {result.get('error')}") 
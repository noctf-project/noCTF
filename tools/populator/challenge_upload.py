import asyncio
import argparse
import os
from typing import List, Dict, Any
from client import CTFClient, upload_challenge_from_yaml, upload_attachments_from_yaml


async def upload_challenges_from_directory(
    client: CTFClient, 
    directory: str,
    upload_files: bool
) -> List[Dict[str, Any]]:
    results = []
    
    yaml_files = [f for f in os.listdir(directory) if f.endswith(('.yml', '.yaml'))]
    
    for file_name in yaml_files:
        file_path = os.path.join(directory, file_name)
        challenge = await upload_challenge_from_file(client, file_path, upload_files)
        results.append(challenge)
    
    return results

async def upload_challenge_from_file(client: CTFClient, file_path: str, upload_files: bool) -> Dict[str, Any]:
    try:
        with open(file_path, 'r') as f:
            yaml_content = f.read()
        
        files = None
        if upload_files:
            files = await upload_attachments_from_yaml(client, yaml_content)
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


async def main():
    parser = argparse.ArgumentParser(description="Upload CTF challenges from YAML files")
    parser.add_argument("--base-url", type=str, required=True, help="Base URL of the CTF API")
    parser.add_argument("--email", type=str, required=True, help="Admin email")
    parser.add_argument("--password", type=str, required=True, help="Admin password")
    parser.add_argument("--upload_files", action='store_true', help="Upload files to noCTF")
    
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--directory", type=str, help="Directory containing challenge YAML files")
    group.add_argument("--file", type=str, help="YAML file containing challenge details")

    args = parser.parse_args()
    
    client = CTFClient(args.base_url)
    
    try:
        await client.login(args.email, args.password)
        results = []
        if args.directory:
            results.extend(await upload_challenges_from_directory(client, args.directory, args.upload_files))
        elif args.file:
            results.append(await upload_challenge_from_file(client, args.file, args.upload_files))  

        success_count = sum(1 for r in results if r.get("status") == "uploaded")
        print(f"\nUploaded {success_count}/{len(results)} challenges successfully")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import argparse
import os
from typing import List, Dict, Any
from client import CTFClient, upload_challenge_from_yaml


async def upload_challenges_from_directory(
    client: CTFClient, 
    directory: str
) -> List[Dict[str, Any]]:
    results = []
    
    yaml_files = [f for f in os.listdir(directory) if f.endswith(('.yml', '.yaml'))]
    
    for file_name in yaml_files:
        file_path = os.path.join(directory, file_name)
        
        try:
            with open(file_path, 'r') as f:
                yaml_content = f.read()
            
            challenge = await upload_challenge_from_yaml(client, yaml_content)
            results.append({
                "file": file_name,
                "challenge_id": challenge.get("id"),
                "title": challenge.get("title"),
                "status": "uploaded"
            })
            print(f"Uploaded challenge: {challenge.get('title')} (ID: {challenge.get('id')})")
        except Exception as e:
            results.append({
                "file": file_name,
                "status": "failed",
                "error": str(e)
            })
            print(f"Failed to upload {file_name}: {str(e)}")
    
    return results


async def main():
    parser = argparse.ArgumentParser(description="Upload CTF challenges from YAML files")
    parser.add_argument("--base-url", type=str, required=True, help="Base URL of the CTF API")
    parser.add_argument("--email", type=str, required=True, help="Admin email")
    parser.add_argument("--password", type=str, required=True, help="Admin password")
    parser.add_argument("--directory", type=str, required=True, help="Directory containing challenge YAML files")
    
    args = parser.parse_args()
    
    client = CTFClient(args.base_url)
    
    try:
        await client.login(args.email, args.password)
        results = await upload_challenges_from_directory(client, args.directory)
        
        success_count = sum(1 for r in results if r.get("status") == "uploaded")
        print(f"\nUploaded {success_count}/{len(results)} challenges successfully")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())

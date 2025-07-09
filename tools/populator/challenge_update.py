import asyncio
import argparse
from lib.challenge_utils import update_challenges_from_directory, update_challenge_from_file, print_results_summary
from client import CTFClient


async def main():
    parser = argparse.ArgumentParser(description="Update CTF challenges from YAML files")
    parser.add_argument("--base-url", type=str, required=True, help="Base URL of the CTF API")
    parser.add_argument("--email", type=str, required=True, help="Admin email")
    parser.add_argument("--password", type=str, required=True, help="Admin password")
    parser.add_argument("--upload_files", action='store_true', help="Upload files to noCTF")
    
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--directory", type=str, help="Directory containing challenge YAML files")
    group.add_argument("--file", type=str, help="YAML file containing challenge details")

    args = parser.parse_args()
    
    client = CTFClient(args.base_url)
    
    try:
        await client.login(args.email, args.password)
        results = []
        
        if args.directory:
            results.extend(await update_challenges_from_directory(client, args.directory, args.upload_files))
        elif args.file:
            results.append(await update_challenge_from_file(client, args.file, args.upload_files))

        print_results_summary(results, "update")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main()) 
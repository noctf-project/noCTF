import asyncio
import argparse
from client import register_user_and_team


async def create_multiple_users_and_teams(base_url: str, count: int, password: str = "Password123!"):
    results = []
    
    for i in range(count):
        try:
            client = await register_user_and_team(base_url, password)
            user_info = await client.get_user()
            team_info = await client.get_team()
            
            results.append({
                "user_id": user_info.get("id"),
                "username": user_info.get("name"),
                "team_id": team_info.get("id"),
                "team_name": team_info.get("name")
            })
            
            await client.close()
            print(f"Created user and team {i+1}/{count}: {user_info.get('name')}")
        except Exception as e:
            print(f"Failed to create user/team {i+1}: {str(e)}")
    
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create CTF users and teams")
    parser.add_argument("--base-url", type=str, required=True, help="Base URL of the CTF API")
    parser.add_argument("--count", type=int, default=10, help="Number of users/teams to create")
    parser.add_argument("--password", type=str, default="Password123!", help="Password for all users")
    
    args = parser.parse_args()
    
    results = asyncio.run(create_multiple_users_and_teams(
        args.base_url, 
        args.count,
        args.password
    ))
    
    print(f"\nCreated {len(results)} users and teams successfully")

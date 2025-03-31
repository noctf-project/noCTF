import asyncio
import argparse
import random
import time
from typing import List, Dict, Any, Optional
from client import CTFClient, register_user_and_team


async def solve_challenge_with_delay(
    client: CTFClient,
    challenge_id: int,
    user_data: Dict[str, Any],
    min_delay: int = 5,
    max_delay: int = 120
) -> Dict[str, Any]:
    try:
        result = await client.solve_challenge(challenge_id)
        solve_time = time.time()
        
        solve_data = {
            "challenge_id": challenge_id,
            "result": result,
            "timestamp": solve_time
        }
        
        print(f"User {user_data['username']} solved challenge {challenge_id}: {result}")
        
        next_delay = random.randint(min_delay, max_delay)
        return {"solve": solve_data, "next_delay": next_delay}
    except Exception as e:
        print(f"Error solving challenge {challenge_id} for user {user_data['username']}: {str(e)}")
        return {"error": str(e), "next_delay": random.randint(min_delay, max_delay)}


async def user_solve_task(
    base_url: str,
    user_data: Dict[str, Any],
    all_challenges: List[Dict[str, Any]],
    max_solves: int,
    min_delay: int = 5,
    max_delay: int = 120,
    simulation_end_time: Optional[float] = None
) -> Dict[str, Any]:
    client = CTFClient(base_url)
    
    try:
        # Login with existing credentials
        await client.login(user_data["email"], user_data["password"])
        solves = []
        
        # Determine challenges to solve
        num_to_solve = random.randint(1, min(max_solves, len(all_challenges)))
        challenges_to_solve = random.sample(all_challenges, num_to_solve)
        
        # Initial delay to stagger starts
        initial_delay = random.randint(0, min_delay)
        await asyncio.sleep(initial_delay)
        
        for challenge in challenges_to_solve:
            # Check if simulation should end
            if simulation_end_time and time.time() >= simulation_end_time:
                break
                
            result = await solve_challenge_with_delay(
                client, 
                challenge["id"], 
                user_data,
                min_delay, 
                max_delay
            )
            
            if "solve" in result:
                solves.append(result["solve"])
            
            # Wait for next solve
            next_delay = result["next_delay"]
            if simulation_end_time:
                next_delay = min(next_delay, max(0, int(simulation_end_time - time.time())))
            
            if next_delay > 0 and challenges_to_solve.index(challenge) < len(challenges_to_solve) - 1:
                await asyncio.sleep(next_delay)
        
        return {
            "user_id": user_data["user_id"],
            "username": user_data["username"],
            "team_id": user_data["team_id"],
            "team_name": user_data["team_name"],
            "solves": solves
        }
    except Exception as e:
        print(f"Error in user task for {user_data['username']}: {str(e)}")
        return {
            "user_id": user_data["user_id"],
            "username": user_data["username"],
            "error": str(e)
        }
    finally:
        await client.close()


async def setup_users_and_teams(
    base_url: str,
    user_count: int
) -> List[Dict[str, Any]]:
    users = []
    
    for i in range(user_count):
        try:
            random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
            username = f"user_{random_str}"
            email = f"{username}@example.com"
            password = "Password123!"
            
            client = CTFClient(base_url)
            await client.register_user(email, username, password)
            team = await client.create_team(username)
            user_info = await client.get_user()
            
            users.append({
                "user_id": user_info.get("id"),
                "username": username,
                "email": email,
                "password": password,
                "team_id": team.get("id"),
                "team_name": team.get("name")
            })
            
            await client.close()
            print(f"Created user {i+1}/{user_count}: {username}")
        except Exception as e:
            print(f"Failed to create user {i+1}: {str(e)}")
    
    return users


async def concurrent_challenge_solving(
    base_url: str,
    user_count: int = 10,
    max_solves_per_user: int = 5,
    min_delay: int = 5,
    max_delay: int = 120,
    time_limit_minutes: Optional[int] = None
) -> Dict[str, Any]:
    # Setup users and teams
    print(f"Creating {user_count} users and teams...")
    users = await setup_users_and_teams(base_url, user_count)
    
    if not users:
        return {"error": "Failed to create any users"}
    
    # Get challenges
    temp_client = CTFClient(base_url)
    try:
        await temp_client.login(users[0]["email"], users[0]["password"])
        all_challenges = await temp_client.get_challenges()
        await temp_client.close()
    except Exception as e:
        await temp_client.close()
        return {"error": f"Failed to get challenges: {str(e)}"}
    
    if not all_challenges:
        return {"error": "No challenges found"}
    
    print(f"Found {len(all_challenges)} challenges")
    
    # Calculate end time if time limit is provided
    simulation_end_time = None
    if time_limit_minutes:
        simulation_end_time = time.time() + (time_limit_minutes * 60)
        print(f"Simulation will run for {time_limit_minutes} minutes")
    
    # Create concurrent tasks for each user
    start_time = time.time()
    tasks = []
    for user in users:
        task = user_solve_task(
            base_url,
            user,
            all_challenges,
            max_solves_per_user,
            min_delay,
            max_delay,
            simulation_end_time
        )
        tasks.append(task)
    
    # Run all user tasks concurrently
    print("Starting concurrent solve tasks...")
    results = await asyncio.gather(*tasks)
    
    end_time = time.time()
    duration = end_time - start_time
    
    # Calculate total solves
    total_solves = sum(len(user.get("solves", [])) for user in results)
    
    print(f"\nSimulation completed in {duration:.2f} seconds")
    print(f"Total solves: {total_solves}")
    
    return {
        "users": results,
        "total_solves": total_solves,
        "duration_seconds": duration
    }


async def main():
    parser = argparse.ArgumentParser(description="Concurrent CTF Challenge Solver")
    parser.add_argument("--base-url", type=str, required=True, help="Base URL of the CTF API")
    parser.add_argument("--user-count", type=int, default=10, help="Number of users to create")
    parser.add_argument("--max-solves", type=int, default=5, help="Maximum solves per user")
    parser.add_argument("--min-delay", type=int, default=5, help="Minimum delay between solves in seconds")
    parser.add_argument("--max-delay", type=int, default=120, help="Maximum delay between solves in seconds")
    parser.add_argument("--time-limit", type=int, help="Time limit for simulation in minutes (optional)")
    
    args = parser.parse_args()
    
    result = await concurrent_challenge_solving(
        args.base_url,
        args.user_count,
        args.max_solves,
        args.min_delay,
        args.max_delay,
        args.time_limit
    )
    
    if "error" in result:
        print(f"Error: {result['error']}")
    else:
        print("\nSimulation Summary:")
        print(f"Users: {len(result['users'])}")
        print(f"Total solves: {result['total_solves']}")
        print(f"Total duration: {result['duration_seconds']:.2f} seconds")


import string  # Add this import at the top of the file

if __name__ == "__main__":
    asyncio.run(main())

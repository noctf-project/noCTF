#!/usr/bin/env python3
"""
Test script for challenge management tools
"""

import asyncio
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from client import CTFClient, ChallengeConverter
from lib.challenge_utils import upload_challenge_from_file, update_challenge_from_file


async def test_challenge_converter():
    """Test the ChallengeConverter with a sample YAML"""
    sample_yaml = """
id: test-challenge
name: Test Challenge
description: This is a test challenge
category: web
tags: [easy]
flag: ["flag{test}"]
files: []
"""
    
    challenge_data = ChallengeConverter.from_yaml(sample_yaml)
    print("✓ ChallengeConverter test passed")
    print(f"  - Slug: {challenge_data.get('slug')}")
    print(f"  - Title: {challenge_data.get('title')}")
    print(f"  - Category: {challenge_data.get('tags', {}).get('categories')}")
    print(f"  - Difficulty: {challenge_data.get('tags', {}).get('difficulty')}")
    return challenge_data


async def test_client_methods():
    """Test that client has required methods"""
    client = CTFClient("http://localhost:3000")
    
    # Check that required methods exist
    required_methods = [
        'login', 'get_challenges', 'create_challenge', 
        'update_challenge', 'create_attachment'
    ]
    
    for method in required_methods:
        if not hasattr(client, method):
            print(f"✗ Missing method: {method}")
            return False
    
    print("✓ All required client methods exist")
    return True


def test_imports():
    """Test that all imports work correctly"""
    try:
        from lib.challenge_utils import (
            upload_challenges_from_directory,
            upload_challenge_from_file,
            update_challenges_from_directory,
            update_challenge_from_file,
            print_results_summary
        )
        print("✓ All imports successful")
        return True
    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False


async def main():
    """Run all tests"""
    print("Testing challenge management tools...\n")
    
    # Test imports
    if not test_imports():
        return False
    
    # Test client methods
    if not await test_client_methods():
        return False
    
    # Test challenge converter
    await test_challenge_converter()
    
    print("\n✓ All tests passed!")
    return True


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1) 
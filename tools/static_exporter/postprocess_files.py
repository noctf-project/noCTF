#!/usr/bin/env python3

import argparse
import logging
import json
import hashlib
from pathlib import Path
from typing import Dict


class NoCTFFilePostProcessor:
    def __init__(self, challenge_details_file: str, repo: str, url: str):
        self.challenge_details_file = challenge_details_file
        self.repo = repo
        self.url = url.strip("/")

        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
            handlers=[
                logging.StreamHandler(),
            ],
        )
        self.logger = logging.getLogger(__name__)

    def _compute_file_hashes(self, repo_path: Path) -> Dict[str, str]:
        hash_to_path = {}

        self.logger.info(f"Scanning repository directory: {repo_path}")

        all_files = [f for f in repo_path.rglob("*") if f.is_file()]
        self.logger.info(f"Found {len(all_files)} files to process")

        for file_path in all_files:
            try:
                with open(file_path, "rb") as f:
                    file_content = f.read()
                    file_hash = hashlib.sha256(file_content).hexdigest()

                relative_path = file_path.relative_to(repo_path)

                hash_to_path[file_hash] = str(relative_path)

                self.logger.debug(f"Computed hash for {relative_path}: {file_hash}")

            except IOError as e:
                self.logger.error(f"Error reading file {file_path}: {e}")
                continue

        self.logger.info(f"Computed hashes for {len(hash_to_path)} files")
        return hash_to_path

    def run(self):
        try:
            with open(self.challenge_details_file, "r") as f:
                challenges = json.load(f)
        except FileNotFoundError:
            self.logger.error(
                f"Challenge details file not found: {self.challenge_details_file}"
            )
            return
        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON in challenge details file: {e}")
            return

        self.logger.info(f"Processing {len(challenges)} challenges")

        hash_to_path = {}
        if self.repo:
            repo_path = Path(self.repo)
            if not repo_path.exists():
                self.logger.error(f"Repository directory does not exist: {self.repo}")
                return
            if not repo_path.is_dir():
                self.logger.error(f"Repository path is not a directory: {self.repo}")
                return

            hash_to_path = self._compute_file_hashes(repo_path)

        for challenge in challenges:
            if (
                "data" in challenge
                and "metadata" in challenge["data"]
                and "files" in challenge["data"]["metadata"]
            ):
                files = challenge["data"]["metadata"]["files"]
                challenge_title = challenge["data"].get("title", "Unknown")
                self.logger.debug(
                    f"Processing challenge '{challenge_title}' with {len(files)} files"
                )

                for file_obj in files:
                    sha256_hash = None
                    filename = file_obj.get("filename", "unknown")

                    if "hash" in file_obj:
                        hash_value = file_obj["hash"]
                        if hash_value.startswith("sha256:"):
                            sha256_hash = hash_value[7:]

                    if sha256_hash:
                        if sha256_hash in hash_to_path:
                            relative_path = hash_to_path[sha256_hash]
                            new_url = f"{self.url}/{relative_path}"

                            self.logger.info(
                                f"Updating URL for {filename} (hash: {sha256_hash[:8]}...): {new_url}"
                            )

                            file_obj["url"] = new_url
                        else:
                            if self.repo:
                                self.logger.error(
                                    f"File with hash {sha256_hash} not found in repository for {filename}"
                                )
                            else:
                                self.logger.warning(
                                    f"No repository provided - cannot verify hash {sha256_hash} for {filename}"
                                )
                    else:
                        self.logger.error(f"Could not determine hash for {filename}")

        try:
            with open(self.challenge_details_file, "w") as f:
                json.dump(challenges, f, separators=(",", ":"), ensure_ascii=False)

            self.logger.info(
                f"Updated challenge details written to {self.challenge_details_file}"
            )

        except IOError as e:
            self.logger.error(f"Error writing updated file: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Postprocess noCTF static export challenge_details.json to fixup file links",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "challenge_details",
        help="Path to input challenge_details.json file to be processed and overwritten",
    )

    parser.add_argument(
        "--repo",
        "-r",
        help="Path to repository containing publish files",
    )

    parser.add_argument(
        "--url",
        "-u",
        help="Base URL to use for file links",
    )

    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Enable verbose logging"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    p = NoCTFFilePostProcessor(args.challenge_details, args.repo, args.url)
    p.run()


if __name__ == "__main__":
    main()

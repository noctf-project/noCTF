#!/usr/bin/env python3

import os
import argparse
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urljoin

import requests
from requests.adapters import HTTPAdapter


class NoCTFExporter:
    def __init__(
        self, base_url: str, token: Optional[str] = None, output_dir: str = "export"
    ):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.output_dir = Path(output_dir)
        self.session = self._create_session()

        self.output_dir.mkdir(parents=True, exist_ok=True)

        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
            handlers=[
                logging.StreamHandler(),
            ],
        )
        self.logger = logging.getLogger(__name__)

    def _create_session(self) -> requests.Session:
        session = requests.Session()

        if self.token:
            session.headers.update({"Authorization": f"Bearer {self.token}"})

        adapter = HTTPAdapter()
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        return session

    def _make_request(
        self, endpoint: str, method: str = "GET", **kwargs
    ) -> Optional[Dict[str, Any]]:
        url = urljoin(self.base_url, endpoint)

        try:
            self.logger.info(f"Fetching {method} {endpoint} {kwargs.get('params') or ''}")
            response = self.session.request(method, url, timeout=30, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Failed to fetch {endpoint}: {e}")
            return None

    def _save_json(
        self, data: Any, filename: str, division_id: int | None = None
    ) -> None:
        if division_id is not None:
            filepath = self.output_dir / f"division:{division_id}" / filename
        else:
            filepath = self.output_dir / filename
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
                # json.dump(data, f, indent=2, ensure_ascii=False)
            self.logger.info(f"Saved {filename}")
        except Exception as e:
            self.logger.error(f"Failed to save {filename}: {e}")

    def _paginate_query(
        self, endpoint: str, query_data: Dict[str, Any], page_size: int = 10000
    ) -> Dict[str, Any]:
        query_data.update({"page": 1, "page_size": page_size})

        response = self._make_request(endpoint, method="POST", json=query_data)
        assert response
        return response

    def export_site_config(self) -> None:
        data = self._make_request("/site/config")
        if data:
            self._save_json(data, "site_config.json")

    def export_divisions(self) -> Dict[str, Any]:
        data = self._make_request("/divisions")
        if data:
            self._save_json(data, "divisions.json")
            return data
        return {}

    def export_team_tags(self) -> Dict[str, Any]:
        data = self._make_request("/team_tags")
        if data:
            self._save_json(data, "team_tags.json")
            return data
        return {}

    def export_teams(self) -> None:
        query_data = {"filters": {}}

        teams = self._paginate_query("/teams/query", query_data, page_size=10000)
        if teams:
            self._save_json(teams, "teams.json")
            self.logger.info(f"Exported {len(teams)} teams")

    def export_users(self) -> None:
        query_data = {"filters": {}}

        users = self._paginate_query("/users/query", query_data, page_size=10000)
        if users:
            self._save_json(users, "users.json")
            self.logger.info(f"Exported {len(users)} users")

    def export_challenges(self) -> Dict[str, Any]:
        challenges = self._make_request("/challenges")
        if challenges:
            self._save_json(challenges, "challenges.json")
            self.logger.info(f"Exported {len(challenges)} challenges")

            challenge_details = []
            for challenge in challenges["data"]["challenges"]:
                challenge_id = challenge.get("id")
                if challenge_id:
                    detail = self._make_request(f"/challenges/{challenge_id}")
                    if detail:
                        challenge_details.append(detail)

            if challenge_details:
                self._save_json(challenge_details, "challenge_details.json")
                self.logger.info(
                    f"Exported details for {len(challenge_details)} challenges"
                )

            return challenges
        return {}

    def export_challenge_solves(
        self, challenges: Dict[str, Any], divisions: Dict[str, Any]
    ) -> None:
        for division in divisions["data"]:
            div_solves = {}
            division_id = division.get("id")
            for challenge in challenges["data"]["challenges"]:
                challenge_id = challenge.get("id")
                if not challenge_id:
                    continue

                solves = self._make_request(
                    f"/challenges/{challenge_id}/solves",
                    params={"division_id": division_id},
                )
                if solves:
                    div_solves[challenge_id] = solves

            if div_solves:
                self._save_json(div_solves, "challenge_solves.json", division_id)
                self.logger.info(
                    f"Exported solves for {len(div_solves)} challenges for division {division_id}"
                )

    def export_scoreboards(
        self, divisions: Dict[str, Any]
    ) -> None:
        for division in divisions["data"]:
            division_id = division.get("id")
            if not division_id:
                continue

            scoreboard = self._make_request(
                f"/scoreboard/divisions/{division_id}",
                params={"page": 1, "page_size": 10000, "graph_interval": 60},
            )
            if scoreboard:
                self._save_json(scoreboard, "scoreboard.json", division_id)
                self.logger.info(f"Exported main scoreboard for division {division_id}")

    def export_announcements(self) -> None:
        announcements = self._make_request("/announcements")
        if announcements:
            self._save_json(announcements, "announcements.json")
            self.logger.info(f"Exported {len(announcements)} announcements")

    def export_statistics(self, divisions: Dict[str, Any]) -> None:
        user_stats = self._make_request("/stats/users")
        if user_stats:
            self._save_json(user_stats, "user_stats.json")
            self.logger.info(f"Exported user statistics")

        for division in divisions["data"]:
            division_id = division.get("id")
            if not division_id:
                continue

            challenge_stats = self._make_request(
                "/stats/challenges", params={"division_id": division_id}
            )
            if challenge_stats:
                self._save_json(challenge_stats, "challenge_stats.json", division_id)
                self.logger.info(
                    f"Exported challenge statistics for division {division_id}"
                )

    def export_all(self) -> None:
        self.logger.info("Starting full export of noCTF data")

        self.export_site_config()
        divisions = self.export_divisions()
        assert divisions, "Failed to export divisions"
        for div in divisions["data"]:
            div_id = div.get("id")
            (self.output_dir / f"division:{div_id}").mkdir(parents=True, exist_ok=True)

        team_tags = self.export_team_tags()

        self.export_teams()
        self.export_users()

        challenges = self.export_challenges()
        assert challenges, "Failed to export challenges"

        self.export_challenge_solves(challenges, divisions)

        self.export_scoreboards(divisions)

        self.export_announcements()

        self.export_statistics(divisions)

        self.logger.info(f"Export completed! Files saved to: {self.output_dir}")


def main():
    parser = argparse.ArgumentParser(
        description="Export noCTF data to static JSON files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "base_url", help="Base URL of the noCTF API (e.g., http://localhost:8000)"
    )

    parser.add_argument(
        "--output",
        "-o",
        default="export",
        help="Output directory for exported files (default: export)",
    )

    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Enable verbose logging"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    TOKEN = os.getenv("NOCTF_TOKEN")
    if not TOKEN:
        print("NOCTF_TOKEN env var for static_export user is required")
        exit(1)

    exporter = NoCTFExporter(args.base_url, TOKEN, args.output)
    exporter.export_all()


if __name__ == "__main__":
    main()

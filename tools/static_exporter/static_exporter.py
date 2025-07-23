#!/usr/bin/env python3

import argparse
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urljoin

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


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
            self.logger.info(f"Fetching {method} {endpoint}")
            response = self.session.request(method, url, timeout=30, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Failed to fetch {endpoint}: {e}")
            return None

    def _save_json(self, data: Any, filename: str) -> None:
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

    def export_team_tags(self) -> None:
        data = self._make_request("/team_tags")
        if data:
            self._save_json(data, "team_tags.json")

    def export_teams(self) -> None:
        query_data = {
            "filters": {}
        }

        teams = self._paginate_query("/teams/query", query_data, page_size=10000)
        if teams:
            self._save_json(teams, "teams.json")
            self.logger.info(f"Exported {len(teams)} teams")

    def export_users(self) -> None:
        query_data = {
            "filters": {}
        }

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

                challenge_solves = {}

                solves = self._make_request(
                    f"/challenges/{challenge_id}/solves",
                    params={"division_id": division_id},
                )
                if solves:
                    div_solves[challenge_id] = challenge_solves

            if div_solves:
                self._save_json(div_solves, "challenge_solves.json")
                self.logger.info(f"Exported solves for {len(div_solves)} challenges")

    def export_scoreboards(self, divisions: Dict[str, Any]) -> None:
        scoreboards = {}

        for division in divisions["data"]:
            division_id = division.get("id")
            if not division_id:
                continue

            scoreboard_data = {}
            scoreboard = self._make_request(
                f"/scoreboard/divisions/{division_id}",
                params={"page": 1, "page_size": 10000},
            )

            scoreboard_data["teams"] = scoreboard
            scoreboard_data["division"] = division

            top_scores = self._make_request(f"/scoreboard/divisions/{division_id}/top")
            if top_scores:
                scoreboard_data["top_score_history"] = top_scores

            scoreboards[division_id] = scoreboard_data

        if scoreboards:
            self._save_json(scoreboards, "scoreboards.json")
            self.logger.info(f"Exported scoreboards for {len(scoreboards)} divisions")

    def export_team_details(self) -> None:
        query_data = {"filters": {}}
        teams = self._paginate_query("/teams/query", query_data, page_size=10000)

        team_details = {}

        for team in teams["data"]["entries"]:
            team_id = team.get("id")
            if not team_id:
                continue

            team_scoreboard = self._make_request(f"/scoreboard/teams/{team_id}")
            if team_scoreboard:
                team_details[f"team_{team_id}"] = team_scoreboard

        if team_details:
            self._save_json(team_details, "team_scoreboards.json")
            self.logger.info(
                f"Exported detailed scoreboards for {len(team_details)} teams"
            )

    def export_announcements(self) -> None:
        announcements = self._make_request("/announcements")
        if announcements:
            self._save_json(announcements, "announcements.json")
            self.logger.info(f"Exported {len(announcements)} announcements")

    def export_statistics(self) -> None:
        stats = {}

        user_stats = self._make_request("/stats/users")
        if user_stats:
            stats["users"] = user_stats

        challenge_stats = self._make_request("/stats/challenges")
        if challenge_stats:
            stats["challenges"] = challenge_stats

        if stats:
            self._save_json(stats, "statistics.json")
            self.logger.info("Exported statistics")

    def export_all(self) -> None:
        self.logger.info("Starting full export of noCTF data")

        self.export_site_config()
        divisions = self.export_divisions()
        self.export_team_tags()

        self.export_teams()
        self.export_users()

        challenges = self.export_challenges()

        if challenges and divisions:
            self.export_challenge_solves(challenges, divisions)

        if divisions:
            self.export_scoreboards(divisions)

        self.export_team_details()

        self.export_announcements()

        self.export_statistics()

        self.logger.info(f"Export completed! Files saved to: {self.output_dir}")


def main():
    parser = argparse.ArgumentParser(
        description="Export noCTF data to static JSON files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "base_url", help="Base URL of the noCTF API (e.g., http://localhost:8000)"
    )

    parser.add_argument("--token", help="Bearer token for API authentication")

    parser.add_argument(
        "--output",
        "-o",
        default="export",
        help="Output directory for exported files (default: export)",
    )

    parser.add_argument(
        "--config", action="store_true", help="Export site configuration"
    )
    parser.add_argument("--divisions", action="store_true", help="Export divisions")
    parser.add_argument("--team-tags", action="store_true", help="Export team tags")
    parser.add_argument("--teams", action="store_true", help="Export teams")
    parser.add_argument("--users", action="store_true", help="Export users")
    parser.add_argument("--challenges", action="store_true", help="Export challenges")
    parser.add_argument("--solves", action="store_true", help="Export challenge solves")
    parser.add_argument("--scoreboards", action="store_true", help="Export scoreboards")
    parser.add_argument(
        "--announcements", action="store_true", help="Export announcements"
    )
    parser.add_argument("--statistics", action="store_true", help="Export statistics")

    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Enable verbose logging"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    exporter = NoCTFExporter(args.base_url, args.token, args.output)

    specific_exports = any(
        [
            args.config,
            args.divisions,
            args.team_tags,
            args.teams,
            args.users,
            args.challenges,
            args.solves,
            args.scoreboards,
            args.announcements,
            args.statistics,
        ]
    )

    if not specific_exports:
        exporter.export_all()
    else:
        divisions = {}
        challenges = {}

        if args.config:
            exporter.export_site_config()

        if args.divisions:
            divisions = exporter.export_divisions()

        if args.team_tags:
            exporter.export_team_tags()

        if args.teams:
            exporter.export_teams()

        if args.users:
            exporter.export_users()

        if args.challenges:
            challenges = exporter.export_challenges()

        if args.solves and challenges:
            if not divisions:
                divisions = exporter.export_divisions()
            exporter.export_challenge_solves(challenges, divisions)

        if args.scoreboards:
            if not divisions:
                divisions = exporter.export_divisions()
            exporter.export_scoreboards(divisions)
            exporter.export_team_details()

        if args.announcements:
            exporter.export_announcements()

        if args.statistics:
            exporter.export_statistics()


if __name__ == "__main__":
    main()

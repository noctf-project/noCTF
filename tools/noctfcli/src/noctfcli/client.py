from pathlib import Path
from contextlib import asynccontextmanager
from typing import Any, Literal, Optional, Union, overload

import httpx
from pydantic import ValidationError as PydanticValidationError

from .exceptions import (
    APIError,
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from .models import (
    Challenge,
    ChallengeConfig,
    ChallengeFile,
    ChallengeFileAttachment,
    ChallengeSummary,
)

from .config import Config


class NoCTFClient:
    """Async HTTP client for noCTF challenge management APIs."""

    def __init__(
        self,
        base_url: str,
        timeout: float = 30.0,
        verify_ssl: bool = True,
    ) -> None:
        """Initialize the client.

        Args:
            base_url: Base URL of the noCTF API
            timeout: Request timeout in seconds
            verify_ssl: Whether to verify SSL certificates
        """

        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.verify_ssl = verify_ssl
        self._token: Optional[str] = None
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self) -> "NoCTFClient":
        await self._ensure_client()
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()

    async def _ensure_client(self) -> None:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
                verify=self.verify_ssl,
            )

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def _request(
        self,
        method: str,
        path: str,
        data: Optional[dict[str, Any]] = None,
        params: Optional[dict[str, Any]] = None,
        files: Optional[dict[str, Any]] = None,
        auth: bool = True,
    ) -> dict[str, Any]:
        await self._ensure_client()
        assert self._client is not None

        headers = {}
        if auth and self._token:
            headers["Authorization"] = f"Bearer {self._token}"

        try:
            response = await self._client.request(
                method=method,
                url=path,
                json=data,
                params=params,
                files=files,
                headers=headers,
            )
        except httpx.RequestError as e:
            raise APIError(f"Request failed: {e}") from e

        if response.status_code == 401:
            raise AuthenticationError("Authentication failed")
        if response.status_code == 404:
            raise NotFoundError("Resource not found")
        if response.status_code == 409:
            raise ConflictError("Resource conflict")
        if response.status_code >= 400:
            error_data = {}
            try:
                error_data = response.json()
                message = error_data.get("message", f"HTTP {response.status_code}")
            except Exception:
                message = f"HTTP {response.status_code}"
            raise APIError(
                message,
                status_code=response.status_code,
                response_data=error_data,
            )

        if response.status_code == 204 or not response.content:
            return {}

        try:
            return response.json()
        except Exception as e:
            msg = f"Failed to parse response: {e}"
            raise APIError(msg) from e

    async def login(self, email: str, password: str) -> str:
        """Login with email and password.

        Args:
            email: User email
            password: User password

        Returns:
            Authentication token
        """

        try:
            login_response = await self._request(
                "POST",
                "/auth/email/finish",
                data={"email": email, "password": password},
                auth=False,
            )
        except NotFoundError:
            # noCTF returns a 404 on incorrect login, so we raise it again as an AuthenticationError
            raise AuthenticationError("Failed to login, login details may be incorrect")

        token = login_response.get("data", {}).get("token")
        if not token:
            msg = "No token in login response"
            raise AuthenticationError(msg)

        self._token = token
        return token

    async def list_challenges(
        self,
        hidden: Optional[bool] = None,
    ) -> list[ChallengeSummary]:
        """List all challenges.

        Args:
            hidden: Filter by hidden status

        Returns:
            List of challenge summaries
        """

        params = {}
        if hidden is not None:
            params["hidden"] = hidden

        response = await self._request("GET", "/admin/challenges", params=params)
        challenges_data = response.get("data", [])

        try:
            return [ChallengeSummary(**challenge) for challenge in challenges_data]
        except PydanticValidationError as e:
            msg = f"Invalid challenge data: {e}"
            raise ValidationError(msg) from e

    async def get_challenge_files(
        self,
        files: list[ChallengeFileAttachment],
    ) -> list[ChallengeFile]:
        out = []
        for f in files:
            response = await self._request("GET", f"/admin/files/{f.id}")
            file_data = response.get("data", {})
            out.append(ChallengeFile(**file_data))
        return out

    @overload
    async def get_challenge(
        self,
        slug: str,
        with_files: Literal[False] = False,
    ) -> Challenge: ...
    @overload
    async def get_challenge(
        self,
        slug: str,
        with_files: Literal[True] = True,
    ) -> tuple[Challenge, list[ChallengeFile]]: ...
    async def get_challenge(
        self,
        slug: str,
        with_files: bool = False,
    ) -> Union[Challenge, tuple[Challenge, list[ChallengeFile]]]:
        """Get a challenge by slug.

        Args:
            challenge_id: Challenge slug
            with_files: Whether to fetch file details

        Returns:
            Challenge data
        """

        challs = await self.list_challenges()
        chall = next((c for c in challs if c.slug == slug), None)
        if not chall:
            raise NotFoundError(f"Challenge with slug {slug} not found")

        response = await self._request("GET", f"/admin/challenges/{chall.id}")
        challenge_data = response.get("data", {})

        try:
            challenge = Challenge(**challenge_data)
        except PydanticValidationError as e:
            msg = f"Invalid challenge data: {e}"
            raise ValidationError(msg) from e

        if with_files:
            files = await self.get_challenge_files(challenge.files)
            return challenge, files

        return challenge

    async def create_challenge(
        self,
        config: ChallengeConfig,
        files: list[ChallengeFileAttachment],
    ) -> Challenge:
        """Create a new challenge.

        Args:
            config: Challenge configuration
            files: List of files to associate with the challenge

        Returns:
            Created challenge
        """

        api_data = self._config_to_api_data(config, files)

        response = await self._request("POST", "/admin/challenges", data=api_data)
        challenge_data = response.get("data", {})

        try:
            return Challenge(**challenge_data)
        except PydanticValidationError as e:
            msg = f"Invalid challenge data: {e}"
            raise ValidationError(msg) from e

    async def update_challenge(
        self,
        challenge_id: Union[int, str],
        config: ChallengeConfig,
        files: list[ChallengeFileAttachment],
        version: int,
    ) -> int:
        """Update an existing challenge.

        Args:
            challenge_id: Challenge ID or slug
            config: Updated challenge configuration
            files: List of files to associate with the challenge
            version: Current challenge version

        Returns:
            New version number
        """

        api_data = self._config_to_api_data(config, files)
        api_data["version"] = version

        response = await self._request(
            "PUT",
            f"/admin/challenges/{challenge_id}",
            data=api_data,
        )
        return response.get("data", {}).get("version", version + 1)

    async def delete_challenge(self, slug: str) -> None:
        """Delete a challenge.

        Args:
            slug: Challenge slug
        """

        challenge = await self.get_challenge(slug)
        await self._request("DELETE", f"/admin/challenges/{challenge.id}")

    async def upload_file(self, file_path: Path) -> ChallengeFile:
        """Upload a challenge file.

        Args:
            file_path: Path to the file to upload

        Returns:
            File metadata
        """

        if not file_path.exists():
            msg = f"File not found: {file_path}"
            raise FileNotFoundError(msg)

        with open(file_path, "rb") as f:
            files = {"file": (file_path.name, f)}
            response = await self._request("POST", "/admin/files", files=files)

        file_data = response.get("data", {})

        try:
            return ChallengeFile(**file_data)
        except PydanticValidationError as e:
            msg = f"Invalid file data: {e}"
            raise ValidationError(msg) from e

    def _config_to_api_data(
        self,
        config: ChallengeConfig,
        files: list[ChallengeFileAttachment],
    ) -> dict[str, Any]:
        """Convert ChallengeConfig to API format.

        Args:
            config: Challenge configuration
            files: List of files to associate with the challenge

        Returns:
            API-formatted data
        """

        flags = []
        for flag in config.flags:
            if isinstance(flag, str):
                flags.append({"data": flag, "strategy": "case_sensitive"})
            else:
                flags.append({"data": flag.data, "strategy": flag.strategy.value})

        tags = dict(config.tags)
        tags["categories"] = ",".join(config.categories)
        tags["difficulty"] = config.difficulty

        description = config.description
        if config.connection_info:
            description = f"{description}\n\n{config.connection_info}"

        return {
            "slug": config.slug,
            "title": config.title,
            "description": description,
            "tags": tags,
            "hidden": config.hidden,
            "visible_at": config.visible_at.isoformat() if config.visible_at else None,
            "private_metadata": {
                "solve": {
                    "source": config.solve.source,
                    "flag": flags,
                },
                "score": {
                    "params": config.scoring.params,
                    "strategy": config.scoring.strategy,
                    "bonus": config.scoring.bonus,
                },
                "files": [
                    {"id": f.id, "is_attachment": f.is_attachment} for f in files
                ],
            },
        }

    async def upload_challenge_files(
        self,
        config: ChallengeConfig,
        base_path: Path,
    ) -> list[ChallengeFile]:
        """Upload all files for a challenge.

        Args:
            config: Challenge configuration
            base_path: Base path for resolving relative file paths

        Returns:
            List of uploaded file metadata
        """

        uploaded_files = []

        for file_path_str in config.files:
            file_path = base_path / file_path_str
            uploaded_file = await self.upload_file(file_path)
            uploaded_files.append(uploaded_file)

        return uploaded_files


@asynccontextmanager
async def create_client(config: Config):
    """Create an authenticated noCTF client instance

    Args:
        config: noctfcli configuration object

    Returns:
        Authenticated noCTF client
    """
    client = NoCTFClient(
        config.api_url,
        timeout=config.timeout,
        verify_ssl=config.verify_ssl,
    )
    email, password = config.get_credentials()
    await client.login(email, password)
    try:
        yield client
    finally:
        pass

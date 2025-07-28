import os
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field

from .exceptions import ConfigurationError


class Config(BaseModel):
    """noctfcli configuration."""

    api_url: str = Field(..., description="noCTF API base URL")
    email: Optional[str] = Field(default=None, description="Admin email")
    password: Optional[str] = Field(default=None, description="Admin password")
    verify_ssl: bool = Field(default=True, description="Verify SSL certificates")
    timeout: float = Field(default=30.0, description="Request timeout in seconds")

    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables.

        Returns:
            Configuration instance

        Raises:
            ConfigurationError: If required configuration is missing
        """

        api_url = os.getenv("NOCTF_API_URL")
        if not api_url:
            raise ConfigurationError(
                "NOCTF_API_URL environment variable is required",
            )

        return cls(
            api_url=api_url,
            email=os.getenv("NOCTF_EMAIL"),
            password=os.getenv("NOCTF_PASSWORD"),
            verify_ssl=os.getenv("NOCTF_VERIFY_SSL", "true").lower() == "true",
            timeout=float(os.getenv("NOCTF_TIMEOUT", "30.0")),
        )

    @classmethod
    def from_file(cls, config_path: Path) -> "Config":
        """Load configuration from a file.

        Args:
            config_path: Path to configuration file

        Returns:
            Configuration instance

        Raises:
            ConfigurationError: If configuration file is invalid
        """

        if not config_path.exists():
            msg = f"Configuration file not found: {config_path}"
            raise ConfigurationError(msg)

        try:
            with open(config_path) as f:
                data = yaml.safe_load(f)
            return cls(**data)
        except Exception as e:
            msg = f"Invalid configuration file: {e}"
            raise ConfigurationError(msg) from e

    def get_credentials(self) -> tuple[str, str]:
        """Get email and password credentials.

        Returns:
            Tuple of (email, password)

        Raises:
            ConfigurationError: If credentials are not configured
        """

        if not self.email or not self.password:
            msg = (
                "Email and password must be configured via environment variables "
                "NOCTF_EMAIL and NOCTF_PASSWORD or configuration file"
            )
            raise ConfigurationError(msg)
        return self.email, self.password

import os
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field

from .exceptions import ConfigurationError


class Config(BaseModel):
    """noctfcli configuration."""

    api_url: str = Field(..., description="noCTF API base URL")
    token: Optional[str] = Field(default=None, description="Authentication token")
    verify_ssl: bool = Field(default=True, description="Verify SSL certificates")
    timeout: float = Field(default=30.0, description="Request timeout in seconds")

    @classmethod
    def init(cls, config_path: Path) -> "Config":
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

        token = os.getenv("NOCTF_TOKEN")
        if not token:
            raise ConfigurationError(
                "NOCTF_TOKEN environment variable is required",
            )

        try:
            with open(config_path) as f:
                data = yaml.safe_load(f)
            return cls(**data, token=token)
        except Exception as e:
            msg = f"Invalid configuration file: {e}"
            raise ConfigurationError(msg) from e

    def get_token(self) -> str:
        """Get authentication token.

        Returns:
            Authentication token

        Raises:
            ConfigurationError: If token is not configured
        """

        if not self.token:
            msg = (
                "Authentication token must be configured via environment variable "
                "NOCTF_TOKEN"
            )
            raise ConfigurationError(msg)
        return self.token

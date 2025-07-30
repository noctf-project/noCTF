from typing import Any, Optional


class NoCTFError(Exception):
    """Base exception for all noctfcli errors."""

    def __init__(self, message: str, details: Optional[dict[str, Any]] = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidationError(NoCTFError):
    """Raised when challenge configuration validation fails."""

    def __init__(
        self,
        message: str,
        field: Optional[str] = None,
        value: Optional[Any] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message, details)
        self.field = field
        self.value = value


class APIError(NoCTFError):
    """Raised when API requests fail."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response_data: Optional[dict[str, Any]] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message, details)
        self.status_code = status_code
        self.response_data = response_data or {}


class AuthenticationError(APIError):
    """Raised when authentication fails."""


class NotFoundError(APIError):
    """Raised when a resource is not found."""


class ConflictError(APIError):
    """Raised when there's a conflict (e.g., duplicate slug)."""


class FileNotFoundError(NoCTFError):
    """Raised when a challenge file is not found."""


class ConfigurationError(NoCTFError):
    """Raised when there's an issue with configuration."""

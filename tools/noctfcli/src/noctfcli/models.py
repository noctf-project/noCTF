from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional, Union

from pydantic import BaseModel, Field, ConfigDict, field_validator


class FlagStrategy(str, Enum):
    """Flag matching strategies."""

    CASE_SENSITIVE = "case_sensitive"
    CASE_INSENSITIVE = "case_insensitive"
    REGEX = "regex"


class SolveInputType(str, Enum):
    """Types of input for solving challenges."""

    TEXT = "text"
    FILE = "file"
    NONE = "none"


class Flag(BaseModel):
    """Challenge flag configuration."""

    data: str = Field(..., description="Flag content")
    strategy: FlagStrategy = Field(
        default=FlagStrategy.CASE_SENSITIVE,
        description="Flag matching strategy",
    )


class ScoringConfig(BaseModel):
    """Challenge scoring configuration."""

    strategy: str = Field(default="core:static", description="Scoring strategy")
    params: dict[str, Any] = Field(
        default_factory=lambda: {"base": 100},
        description="Strategy-specific parameters",
    )
    bonus: list[float] = Field(default_factory=list, description="Bonus points")


class SolveConfig(BaseModel):
    """Challenge solve configuration."""

    source: str = Field(default="flag", description="Solve source type")
    input_type: SolveInputType = Field(
        default=SolveInputType.TEXT,
        description="Type of input required for solving",
    )


class ChallengeConfig(BaseModel):
    """Challenge configuration from noctf.yaml."""

    model_config = ConfigDict(extra="allow")

    version: str = Field(default="1.0", description="Schema version")
    slug: str = Field(..., description="Unique challenge identifier")
    title: str = Field(..., description="Challenge display name")
    categories: list[str] = Field(..., description="Challenge categories")
    description: str = Field(..., description="Challenge description")
    difficulty: Optional[str] = Field(..., description="Challenge difficulty")
    tags: dict[str, str] = Field(default_factory=dict, description="Additional tags")
    flags: list[Union[str, Flag]] = Field(..., description="Challenge flags")
    files: list[str] = Field(default_factory=list, description="Challenge files")
    hidden: bool = Field(default=False, description="Whether challenge is hidden")
    visible_at: Optional[datetime] = Field(
        default=None,
        description="When challenge becomes visible",
    )
    scoring: ScoringConfig = Field(
        default_factory=ScoringConfig,
        description="Scoring configuration",
    )
    solve: SolveConfig = Field(
        default_factory=SolveConfig,
        description="Solve configuration",
    )
    connection_info: Optional[str] = Field(
        default=None,
        description="Connection information template",
    )

    @field_validator("slug")
    def validate_slug(cls, v: str) -> str:
        """Validate slug format."""
        if not v.replace("-", "").replace("_", "").isalnum():
            msg = "Slug must contain only alphanumeric characters and hyphens"
            raise ValueError(msg)
        if len(v) > 64:
            msg = "Slug must be 64 characters or less"
            raise ValueError(msg)
        return v.lower()

    @field_validator("flags")
    def normalize_flags(cls, v: list[Union[str, dict[str, Any]]]) -> list[Flag]:
        """Normalize flags to Flag objects."""
        normalized = []
        for flag in v:
            if isinstance(flag, str):
                normalized.append(Flag(data=flag))
            elif isinstance(flag, dict):
                normalized.append(Flag(**flag))
            else:
                normalized.append(flag)
        return normalized

    def get_file_paths(self, base_path: Path) -> list[Path]:
        """Get absolute paths for all challenge files."""
        return [base_path / file_path for file_path in self.files]


class ChallengeFile(BaseModel):
    """Challenge file metadata."""

    id: int = Field(..., description="File ID")
    filename: str = Field(..., description="Original filename")
    ref: str = Field(..., description="File ref")
    size: int = Field(..., description="File size in bytes")
    mime: str = Field(..., description="File mimetype")
    hash: str = Field(..., description="File hash")
    url: str = Field(..., description="Download URL")
    provider: str = Field(..., description="Provider")


class ChallengeFileAttachment(BaseModel):
    """Challenge file attachment."""

    id: int = Field(..., description="File ID")
    is_attachment: bool = Field(..., description="Whether file is an attachment")


class Challenge(BaseModel):
    """Full challenge data from API."""

    id: int = Field(..., description="Challenge ID")
    slug: str = Field(..., description="Challenge slug")
    title: str = Field(..., description="Challenge title")
    description: str = Field(..., description="Challenge description")
    tags: dict[str, str] = Field(..., description="Challenge tags")
    hidden: bool = Field(..., description="Whether challenge is hidden")
    version: int = Field(..., description="Challenge version")
    visible_at: Optional[datetime] = Field(
        ..., description="When challenge becomes visible"
    )
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    private_metadata: dict[str, Any] = Field(..., description="Private metadata")

    @property
    def files(self) -> list[ChallengeFileAttachment]:
        """Get challenge files."""
        files_data = self.private_metadata.get("files", [])
        return [ChallengeFileAttachment(**file_data) for file_data in files_data]

    @property
    def flags(self) -> list[Flag]:
        """Get challenge flags."""
        solve_data = self.private_metadata.get("solve", {})
        flags_data = solve_data.get("flag", [])
        return [Flag(**flag_data) for flag_data in flags_data]


class ChallengeSummary(BaseModel):
    """Challenge summary for listing."""

    id: int
    slug: str
    title: str
    tags: dict[str, str]
    hidden: bool
    visible_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class UploadUpdateResultEnum(str, Enum):
    UPLOADED = "uploaded"
    UPDATED = "updated"
    VALIDATED = "validated"
    SKIPPED = "skipped"
    FAILED = "failed"


class UploadUpdateResult(BaseModel):
    challenge: str = Field(..., description="Challenge slug")
    status: UploadUpdateResultEnum = Field(..., description="Result status")
    error: Optional[str] = Field(default=None, description="Error message")

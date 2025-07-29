import json
from pathlib import Path
from typing import Any, Optional

import jsonschema
import yaml
from pydantic import ValidationError as PydanticValidationError

from .exceptions import ValidationError
from .models import ChallengeConfig


class ChallengeValidator:
    """Validates challenge configurations."""

    def __init__(self, schema_path: Optional[Path] = None) -> None:
        """Initialize validator.

        Args:
            schema_path: Path to JSON schema file
        """

        if schema_path is None:
            schema_path = Path(__file__).parent / "schema" / "noctf.yaml.schema.json"

        self.schema_path = schema_path
        self._schema: Optional[dict[str, Any]] = None

    @property
    def schema(self) -> dict[str, Any]:
        """Get JSON schema."""

        if self._schema is None:
            if not self.schema_path.exists():
                msg = f"Schema file not found: {self.schema_path}"
                raise ValidationError(msg)

            try:
                with open(self.schema_path) as f:
                    self._schema = json.load(f)
            except Exception as e:
                msg = f"Invalid schema file: {e}"
                raise ValidationError(msg) from e

        assert self._schema
        return self._schema

    def validate_yaml_file(self, yaml_path: Path) -> ChallengeConfig:
        """Validate a noctf.yaml file.

        Args:
            yaml_path: Path to noctf.yaml file

        Returns:
            Validated challenge configuration

        Raises:
            ValidationError: If validation fails
        """

        if not yaml_path.exists():
            msg = f"File not found: {yaml_path}"
            raise ValidationError(msg)

        try:
            with open(yaml_path) as f:
                data = yaml.safe_load(f)
        except Exception as e:
            msg = f"Invalid YAML file: {e}"
            raise ValidationError(msg) from e

        return self.validate_data(data, yaml_path)

    def validate_data(
        self, data: dict[str, Any], source: Optional[Path] = None
    ) -> ChallengeConfig:
        """Validate challenge configuration data.

        Args:
            data: Configuration data
            source: Source file path (for error reporting)

        Returns:
            Validated challenge configuration

        Raises:
            ValidationError: If validation fails
        """

        try:
            jsonschema.validate(data, self.schema)
        except jsonschema.ValidationError as e:
            source_info = f" in {source}" if source else ""
            raise ValidationError(
                f"Schema validation failed{source_info}: {e.message}",
                field=".".join(str(p) for p in e.absolute_path),
                value=e.instance,
            ) from e

        try:
            return ChallengeConfig(**data)
        except PydanticValidationError as e:
            source_info = f" in {source}" if source else ""
            errors = []
            for error in e.errors():
                field = ".".join(str(p) for p in error["loc"])
                errors.append(f"{field}: {error['msg']}")

            raise ValidationError(
                f"Model validation failed{source_info}: {'; '.join(errors)}",
            ) from e

    def validate_files_exist(
        self, config: ChallengeConfig, base_path: Path
    ) -> list[str]:
        """Validate that all referenced files exist.

        Args:
            config: Challenge configuration
            base_path: Base path for resolving relative file paths

        Returns:
            List of missing files (empty if all files exist)
        """

        missing_files = []

        for file_path_str in config.files:
            file_path = base_path / file_path_str
            if not file_path.exists():
                missing_files.append(file_path_str)

        return missing_files

    def validate_challenge_complete(self, yaml_path: Path) -> ChallengeConfig:
        """Perform complete validation of a challenge.

        Args:
            yaml_path: Path to noctf.yaml file

        Returns:
            Validated challenge configuration

        Raises:
            ValidationError: If validation fails
        """

        config = self.validate_yaml_file(yaml_path)

        base_path = yaml_path.parent
        missing_files = self.validate_files_exist(config, base_path)

        if missing_files:
            raise ValidationError(
                f"Missing challenge files: {', '.join(missing_files)}",
                details={"missing_files": missing_files},
            )

        return config

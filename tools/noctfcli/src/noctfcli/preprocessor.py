from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from noctfcli.models import ChallengeConfig


class PreprocessorBase(ABC):
    @abstractmethod
    def __init__(self, config_path: Optional[Path]):
        pass

    @abstractmethod
    def preprocess(self, challenge_config: ChallengeConfig) -> ChallengeConfig:
        pass

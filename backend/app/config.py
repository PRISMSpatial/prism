from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DEMO_MODE: bool = True
    UPLOAD_DIR: Path = Path(__file__).parent.parent / "data" / "uploads"
    JWT_SECRET: str = "prism-dev-secret-change-in-production"
    JWT_EXPIRE_SECONDS: int = 900

    model_config = {"env_prefix": "PRISM_"}


settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

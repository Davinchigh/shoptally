from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables (or a .env file)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"  # set to "production" when deployed
    database_url: str = "sqlite:///./shoptally.db"
    jwt_secret: str = "change-me-in-production"
    jwt_expiry_minutes: int = 60 * 12
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    # How far apart (in minutes) a sale and a MoMo payment can be and still be matched by amount.
    match_window_minutes: int = 30

    def check(self) -> None:
        """Refuse to start in production with the placeholder signing key."""
        if self.environment == "production" and (self.jwt_secret == "change-me-in-production" or len(self.jwt_secret) < 32):
            raise RuntimeError("Set JWT_SECRET to a random string of at least 32 characters before running in production.")

    @property
    def sqlalchemy_url(self) -> str:
        """Hosted Postgres (Neon, Vercel) hands out postgres:// URLs; use the psycopg 3 driver for them."""
        url = self.database_url
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix) :]
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

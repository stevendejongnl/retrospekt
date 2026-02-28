from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "retrospekt"
    session_expiry_days: int = 30
    redis_url: str = "redis://localhost:6379"
    sentry_dsn: str = ""
    admin_password_hash: str = ""  # empty = admin disabled (safe default)
    sentry_auth_token: str = ""
    sentry_org_slug: str = ""
    sentry_project_slug: str = ""

    @property
    def sentry_api_configured(self) -> bool:
        return bool(self.sentry_auth_token and self.sentry_org_slug and self.sentry_project_slug)


settings = Settings()

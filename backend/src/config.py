from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "retrospekt"
    session_expiry_days: int = 30
    redis_url: str = "redis://localhost:6379"
    sentry_dsn: str = ""


settings = Settings()

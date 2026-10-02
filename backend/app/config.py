"""
Configuración de la aplicación
Maneja las variables de entorno y configuración global
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Configuración de la aplicación usando Pydantic Settings"""
    
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    
    # Google Cloud (opcional por ahora)
    GCP_PROJECT_ID: str = ""
    
    # API Settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    ALLOWED_ORIGINS: str = "http://localhost:5173"
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # Email Configuration (SMTP Gmail)
    EMAIL_SENDER: str = ""
    EMAIL_PASSWORD: str = ""
    
    @property
    def cors_origins(self) -> List[str]:
        """Convierte la cadena de orígenes permitidos en una lista"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


# Instancia global de configuración
settings = Settings()

# ============================================================
# IA — Google ADK api_server
# Usado por: ia-diagnostico y ia-seguimiento
# El CMD se define en docker-compose para cada servicio
# ============================================================
FROM python:3.11-slim

WORKDIR /app

# Dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python (requirements SIN pywin32)
COPY requirements-docker.txt .
RUN pip install --no-cache-dir -r requirements-docker.txt

# Copiar agente de diagnóstico
COPY multi_agente_diagnostico/ multi_agente_diagnostico/

EXPOSE 9000

# El CMD lo define docker-compose con el agente específico:
# adk api_server multi_agente_diagnostico --port 9000
CMD ["adk", "api_server", "--help"]

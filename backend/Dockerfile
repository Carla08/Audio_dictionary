# ───── STAGE 1: Build with Poetry ─────
FROM python:3.9-alpine AS builder

# Set envs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install build dependencies
RUN apk add --no-cache \
    gcc musl-dev libffi-dev openssl-dev \
    curl git

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 - && \
    ln -s /root/.local/bin/poetry /usr/local/bin/poetry

# Set workdir
WORKDIR /app

# Copy Poetry files and install dependencies
COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.create false && \
    poetry install --only main --no-root --no-interaction --no-ansi

# ───── STAGE 2: Runtime ─────
FROM python:3.9-alpine AS runtime

# Set envs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg libffi openssl

# Set workdir
WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /usr/local/lib/python3.9 /usr/local/lib/python3.9
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages

# Copy app source code
COPY . .

# Optional: include env file (dev only)
COPY .env .env

# Expose FastAPI port
EXPOSE 8000

# Launch app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

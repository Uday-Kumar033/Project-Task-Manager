# Task Manager — Docker deployment on EC2

This setup runs React/Nginx, FastAPI, and MySQL as separate Docker containers. It uses Python 3.12 inside the backend image to avoid the Python 3.14/PyO3 build failure. No host Python virtual environment is needed.

## 1. EC2 prerequisites

- Ubuntu EC2 instance (recommended: at least 2 GB RAM for a learning deployment).
- Security group inbound: SSH (22) from your IP and HTTP (80) from the internet. Do not expose ports 3306 or 8000.
- Install Docker Engine and the Docker Compose plugin using Docker's official Ubuntu installation instructions, then verify:

```bash
docker --version
docker compose version
```

## 2. Copy project to EC2

Upload the project folder/ZIP or clone your repository. Then enter the project root, the directory containing `docker-compose.yml`:

```bash
cd ~/task-manager
```

## 3. Configure secrets

```bash
cp .env.example .env
nano .env
```

Set strong, unique values for `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, and `SECRET_KEY`. Keep database passwords URL-safe (letters/numbers and `-_`) because the current SQLAlchemy URL is assembled as a string. Generate a JWT secret with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Set `FRONTEND_ORIGIN=http://YOUR_EC2_PUBLIC_IP` for the current HTTP setup. Do not commit `.env` to Git.

## 4. Build and start all containers

From the project root:

```bash
docker compose config
docker compose up -d --build
```

Check status and logs:

```bash
docker compose ps
docker compose logs -f --tail=100
```

Open `http://YOUR_EC2_PUBLIC_IP` in your browser. The frontend calls `/api/...`; its Nginx container proxies those requests to FastAPI. MySQL is reachable only on the internal Docker network.

## 5. Troubleshooting

```bash
docker compose ps
docker compose logs backend
docker compose logs db
docker compose logs frontend
```

Check the backend health endpoint from inside the backend container:

```bash
docker compose exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/').read().decode())"
```

Rebuild after changing application code:

```bash
docker compose up -d --build
```

Stop containers (database data remains in the named volume):

```bash
docker compose down
```

To delete containers and the database data permanently, use `docker compose down -v` (destructive; do not run unless you intend to erase the database).

## Notes

- The first build needs internet access to download base images and packages.
- MySQL data persists in the `mysql_data` Docker volume.
- For production use, add HTTPS with a domain name, back up the database, and rotate secrets. The default deployment exposes only HTTP port 80; it does not configure TLS.

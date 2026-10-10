# Docker-to-Kubernetes Deployment Changes

This document records the deployment-related changes made to the original `task-manager-docker` project so the application can run as containers under Kubernetes. The application remains a three-tier system:

- **Frontend:** React, Vite, and Nginx
- **Backend:** FastAPI and SQLAlchemy
- **Database:** MySQL

The primary goal was to package the existing application into Docker images and add Kubernetes resources to deploy, connect, expose, and persist the three tiers. The changes are deployment-focused; the main React pages/components and FastAPI route/business logic were not intentionally redesigned.

## 1. New files added

### Docker support

| File | Purpose |
|---|---|
| `backend/Dockerfile` | Builds the FastAPI backend image using Python 3.12 and starts Uvicorn on port `8000`. Python 3.12 avoids the Python 3.14/PyO3 compatibility problem encountered on the EC2 host. |
| `backend/.dockerignore` | Excludes local-only files and unnecessary content from the backend build context. |
| `backend/.env.example` | Documents the backend environment variables for local/container configuration. |
| `frontend/Dockerfile` | Multi-stage build: builds the Vite/React frontend with Node.js, then serves the compiled files using Nginx. |
| `frontend/nginx.conf` | Serves the React single-page app and proxies `/api/` requests to the Kubernetes/Docker backend service. It removes the `/api` prefix before forwarding because the FastAPI routes use paths such as `/auth` and `/tasks`. |
| `frontend/.dockerignore` | Excludes local dependencies/build artifacts from the frontend image build context. |
| `.dockerignore` | Excludes root-level files that are not needed in the Docker build context. |
| `.env.example` | Example root environment configuration for Docker Compose. Do not put real secrets in this file. |
| `docker-compose.yml` | Runs frontend, backend, and MySQL together with Docker Compose for a non-Kubernetes container deployment. |
| `DOCKER_DEPLOYMENT.md` | Documents the Docker Compose deployment steps for EC2. |

### Kubernetes support

| File | Purpose |
|---|---|
| `kubernetes/00-namespace.yaml` | Creates the isolated `task-manager` namespace. |
| `kubernetes/01-configmap.yaml` | Stores non-sensitive configuration such as database host/name/port and token expiry settings. |
| `kubernetes/02-mysql-pvc.yaml` | Requests persistent storage for MySQL data through a 5 GiB PersistentVolumeClaim named `mysql-data`. |
| `kubernetes/03-mysql.yaml` | Deploys MySQL 8.4 and creates an internal ClusterIP Service named `mysql`; database credentials are read from a Kubernetes Secret. |
| `kubernetes/04-backend.yaml` | Deploys FastAPI, waits for MySQL to accept authenticated connections, injects configuration/secrets, configures health probes, and creates the internal `backend:8000` Service. |
| `kubernetes/05-frontend.yaml` | Deploys the Nginx frontend and exposes it through NodePort `30080`. |
| `kubernetes/README.md` | Provides image build/push commands, Secret creation, manifest application, verification, access, and troubleshooting instructions. |

## 2. Existing files modified

| File | Change | Why it was needed |
|---|---|---|
| `backend/requirements.txt` | Updated/pinned compatible package versions, including FastAPI, Uvicorn, SQLAlchemy, Pydantic, and bcrypt dependencies. | Improves reproducibility of the container build and avoids the dependency/build issue previously seen with the host's Python 3.14. The backend image itself uses Python 3.12. |
| `frontend/src/api/client.js` | Changed the default API base URL from a hard-coded local backend URL to `'/api'`, while still allowing `VITE_API_URL` to override it. | Makes frontend API calls work through the Nginx reverse proxy without hard-coding an EC2 IP or a container address into browser-side code. |
| `frontend/.env.example` | Sets the example `VITE_API_URL` to `/api`. | Keeps the example configuration consistent with the Nginx proxy path used by Docker and Kubernetes. |
| `README.md` | Added links/sections for Docker deployment and Kubernetes deployment. | Makes the deployment documentation discoverable from the project home page. |

## 3. Deployment architecture after the changes

```text
Browser
   |
   | http://EC2_PUBLIC_IP:30080
   v
Frontend Service (NodePort 30080)
   |
   v
React static files served by Nginx
   |
   | /api/* proxied internally to backend:8000
   v
Backend Service (ClusterIP: backend:8000)
   |
   v
FastAPI application
   |
   | SQL connection using Kubernetes Secret + ConfigMap
   v
MySQL Service (ClusterIP: mysql:3306)
   |
   v
MySQL data stored on PVC: mysql-data (5 GiB request)
```

The backend and database are internal cluster services. Only the frontend is exposed using NodePort `30080` in the supplied manifests.

## 4. How to deploy the Kubernetes version

Run commands from the project root (the directory containing `backend/`, `frontend/`, and `kubernetes/`).

### Step 1 — Build and push the images

Replace `YOUR_DOCKERHUB_USERNAME` with your Docker Hub username:

```bash
docker login
docker build -t YOUR_DOCKERHUB_USERNAME/task-manager-backend:1.0.0 ./backend
docker push YOUR_DOCKERHUB_USERNAME/task-manager-backend:1.0.0
docker build -t YOUR_DOCKERHUB_USERNAME/task-manager-frontend:1.0.0 ./frontend
docker push YOUR_DOCKERHUB_USERNAME/task-manager-frontend:1.0.0
```

Update the image fields in `kubernetes/04-backend.yaml` and `kubernetes/05-frontend.yaml` to match the pushed image names.

### Step 2 — Create the namespace and Secret

```bash
kubectl apply -f kubernetes/00-namespace.yaml

DB_PASSWORD="$(openssl rand -hex 24)"
MYSQL_ROOT_PASSWORD="$(openssl rand -hex 24)"
SECRET_KEY="$(openssl rand -hex 48)"

kubectl create secret generic task-manager-secrets \
  --namespace task-manager \
  --from-literal=DB_USER=taskapp \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
  --from-literal=SECRET_KEY="$SECRET_KEY"

unset DB_PASSWORD MYSQL_ROOT_PASSWORD SECRET_KEY
```

Create this Secret once for the initial deployment. Keep the credentials safe, and do not commit real secrets to Git. If the Secret already exists, do not regenerate database credentials without coordinating with the existing MySQL data volume.

### Step 3 — Apply the resources

```bash
kubectl apply -f kubernetes/
```

### Step 4 — Check deployment status

```bash
kubectl get all -n task-manager
kubectl get pvc -n task-manager
kubectl get pods -n task-manager -o wide
kubectl rollout status deployment/mysql -n task-manager
kubectl rollout status deployment/backend -n task-manager
kubectl rollout status deployment/frontend -n task-manager
```

### Step 5 — Access the application

Open the following URL, replacing the placeholder with the public IP of a reachable Kubernetes node:

```text
http://EC2_PUBLIC_IP:30080
```

Allow inbound TCP port `30080` in the EC2 Security Group for the intended clients. Do not expose MySQL port `3306` or backend port `8000` publicly.

## 5. Important environment-specific checks

- **Docker Hub images:** Replace every `YOUR_DOCKERHUB_USERNAME` placeholder in the Kubernetes manifests.
- **StorageClass:** `kubernetes/02-mysql-pvc.yaml` uses `storageClassName: local-path`. Confirm it exists with `kubectl get storageclass`; edit the manifest if your cluster uses a different StorageClass.
- **Persistent data:** `local-path` storage is commonly node-local. It is suitable for a learning/single-node setup but requires a more durable storage solution and backups for production or multi-node resilience.
- **EC2 firewall:** Allow TCP `30080` as needed. Keep ports `3306` and `8000` private.
- **Secrets:** Kubernetes Secret values are not automatically safe just because they are stored as a Secret object. Restrict RBAC access and consider encryption at rest for production.
- **Deployment status:** These files provide a deployment configuration, but the manifests still need to be tested in the target cluster and adapted to its actual StorageClass, networking, and image names.

## 6. What was not intentionally changed

The main application behavior and source files—such as React pages/components, authentication context, FastAPI routers, SQLAlchemy models, and schemas—were not intentionally rewritten as part of the Docker/Kubernetes work. The significant application-side adjustment is the frontend API base URL so it can use the same-origin `/api` proxy.

## 7. Useful commands for troubleshooting

```bash
kubectl get pods -n task-manager
kubectl describe pod -n task-manager POD_NAME
kubectl logs -n task-manager deployment/mysql
kubectl logs -n task-manager deployment/backend
kubectl logs -n task-manager deployment/frontend
kubectl get events -n task-manager --sort-by=.lastTimestamp
kubectl describe pvc mysql-data -n task-manager
```

See [`kubernetes/README.md`](kubernetes/README.md) for the complete deployment procedure and troubleshooting notes.

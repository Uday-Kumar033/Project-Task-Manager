# Task Manager on Kubernetes (kubeadm + Docker Hub)

This folder deploys the React/Nginx frontend, FastAPI backend, and MySQL database into the `task-manager` namespace. The frontend is exposed through NodePort `30080`; backend and MySQL are internal ClusterIP Services.

## Important prerequisites

- A working kubeadm cluster and `kubectl` configured for it.
- Docker Hub repositories accessible to every Kubernetes node.
- A StorageClass capable of provisioning a 5Gi PVC. These manifests use `local-path`, which is common with the local-path provisioner. Confirm with `kubectl get storageclass`; change `storageClassName` in `02-mysql-pvc.yaml` if your class has a different name. If your cluster has a default StorageClass, you may remove the `storageClassName` field to use that default.
- Open TCP `30080` in the EC2 Security Group for the clients that need to access the app. Keep ports `3306` and `8000` private.

## 1. Build and push images

Run from the project root (the directory containing `backend/` and `frontend/`). Replace `YOUR_DOCKERHUB_USERNAME` with your lowercase Docker Hub username.

```bash
docker login
docker build -t YOUR_DOCKERHUB_USERNAME/task-manager-backend:1.0.0 ./backend
docker push YOUR_DOCKERHUB_USERNAME/task-manager-backend:1.0.0
docker build -t YOUR_DOCKERHUB_USERNAME/task-manager-frontend:1.0.0 ./frontend
docker push YOUR_DOCKERHUB_USERNAME/task-manager-frontend:1.0.0
```

Edit `04-backend.yaml` and `05-frontend.yaml` and replace `YOUR_DOCKERHUB_USERNAME` in the `image` fields with your actual username. Use public repositories for the simplest setup. If repositories are private, create an `imagePullSecret` and attach it to the Pod specs.

The frontend image uses `VITE_API_URL=/api` at build time. Its Nginx config forwards `/api/...` to the Kubernetes Service `backend:8000` and removes the `/api` prefix, matching this app's `/auth` and `/tasks` routes.

## 2. Create namespace and secrets

First apply the namespace:

```bash
kubectl apply -f kubernetes/00-namespace.yaml
```

Create the Secret once. This generates URL-safe hexadecimal passwords and a random JWT secret, then stores them in Kubernetes. Keep the values safe and do not commit a Secret manifest with real values to Git.

```bash
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

Run the Secret creation command only on first deployment. If the Secret already exists, do not regenerate it casually: the MySQL password must remain consistent with the initialized database volume. For a deliberate credential rotation, plan the MySQL and Secret update together.

## 3. Apply the manifests

From the project root:

```bash
kubectl apply -f kubernetes/
```

If you run the command from inside the `kubernetes/` directory, use `kubectl apply -f .` instead.

## 4. Verify rollout

```bash
kubectl get all -n task-manager
kubectl get pvc -n task-manager
kubectl get pods -n task-manager -o wide
kubectl rollout status deployment/mysql -n task-manager
kubectl rollout status deployment/backend -n task-manager
kubectl rollout status deployment/frontend -n task-manager
```

The backend waits for MySQL to accept authenticated connections before starting. MySQL data is stored on the `mysql-data` PVC. The backend creates its tables on startup using SQLAlchemy.

## 5. Open the app

Get the public IPv4 address of a node that is reachable from your browser. On a single-node EC2 kubeadm cluster, use:

`http://EC2_PUBLIC_IP:30080`

Allow inbound TCP `30080` in that EC2 instance's Security Group. If your cluster has multiple nodes, the NodePort is served on each node, subject to networking and security-group rules.

## 6. Troubleshooting

```bash
kubectl describe pod -n task-manager POD_NAME
kubectl logs -n task-manager deployment/mysql
kubectl logs -n task-manager deployment/backend
kubectl logs -n task-manager deployment/frontend
kubectl get events -n task-manager --sort-by=.lastTimestamp
kubectl describe pvc mysql-data -n task-manager
```

- `ImagePullBackOff`: check the image names/tags and that Docker Hub repositories are public or an image pull Secret is configured.
- PVC `Pending`: verify the StorageClass name and that the provisioner is healthy.
- Backend `CrashLoopBackOff`: inspect backend logs and MySQL readiness; confirm the Secret exists.
- Frontend loads but API requests fail: confirm the backend Service is named `backend`, then inspect frontend Nginx logs and backend logs.

## Notes

- This is a learning deployment for kubeadm, not a hardened production setup.
- NodePort avoids needing a cloud LoadBalancer integration for kubeadm.
- Kubernetes Secrets are base64-encoded by default, not encrypted just by being a Secret. Restrict cluster RBAC and configure encryption at rest for production.
- `local-path` storage is typically node-local. For multi-node or production workloads, use storage with appropriate durability and backup plans.

# Task Manager CI/CD — GitHub Actions, Docker Hub, and Kubernetes

This document explains the CI/CD architecture, configuration, setup, validation, troubleshooting, and security considerations for the Task Manager project.

## 1. Architecture

The application runs in Kubernetes namespace `task-manager` and has three deployments:

- **Frontend**: React served by Nginx; NodePort Service on port `30080`.
- **Backend**: FastAPI; internal ClusterIP Service on port `8000`.
- **MySQL**: database; internal ClusterIP Service on port `3306`.

The pipeline uses GitHub Actions, Docker Hub, a self-hosted GitHub Actions runner on EC2, and Kubernetes.

```text
Developer pushes to main
        |
        v
GitHub-hosted runner: build-and-push
  - Build backend image
  - Build frontend image
  - Push both images to Docker Hub as :latest
        |
        v
Self-hosted runner on EC2: deploy-to-kubernetes
  - Check Kubernetes access
  - Set imagePullPolicy: Always
  - Restart backend and frontend deployments
  - Wait for rollouts
        |
        v
Kubernetes creates replacement Pods and pulls current :latest images
```

MySQL is intentionally not restarted by this workflow.

## 2. Expected repository layout

```text
Project-Task-Manager/
├── backend/Dockerfile
├── frontend/Dockerfile
├── kubernetes/
│   ├── 00-namespace.yaml
│   ├── 01-configmap.yaml
│   ├── 02-mysql-pvc.yaml
│   ├── 03-mysql.yaml
│   ├── 04-backend.yaml
│   ├── 05-frontend.yaml
│   └── 06-cd-rbac.yaml
└── .github/workflows/ci-cd.yaml
```

Change Dockerfile paths if your repository differs.

## 3. CI workflow: build and push

The `build-and-push` job runs on GitHub-hosted `ubuntu-latest`. It checks out source, sets up Docker Buildx, logs in to Docker Hub, builds the backend and frontend images, and pushes:

- `mruday033/task-manager-backend:latest`
- `mruday033/task-manager-frontend:latest`

### Required GitHub Actions secrets

In your repository, open **Settings → Secrets and variables → Actions** and add:

- `DOCKERHUB_USERNAME`: your Docker Hub username.
- `DOCKERHUB_TOKEN`: a Docker Hub access token (prefer this over your account password).

Do not hardcode tokens in workflow files or commit them to Git.

## 4. CD workflow: deploy to Kubernetes

The `deploy-to-kubernetes` job runs on `self-hosted` and has `needs: build-and-push`, so it only starts after both image pushes succeed. Your runner process currently runs as Linux user `ubuntu`, so the workflow points to:

```yaml
KUBECONFIG: /home/ubuntu/.kube/task-manager-config
```

That kubeconfig should use the dedicated `task-manager-deployer` ServiceAccount, not `/etc/kubernetes/admin.conf`.

The deployment job:

1. Checks Kubernetes access.
2. Checks that the identity can patch deployments in `task-manager`.
3. Sets `imagePullPolicy: Always` on backend and frontend containers.
4. Restarts backend and frontend to make Kubernetes create replacement Pods even though the image string remains `:latest`.
5. Waits for both rollouts and prints deployment images and Pods.

### Why restart is used with `latest`

A successful Docker Hub push does not notify Kubernetes. Also, changing an image from `:latest` to the same `:latest` string may not change the Pod template, so it may not trigger a rollout. The workflow restarts the deployments after the image push. With `imagePullPolicy: Always`, new Pods ask the registry for the current image behind the mutable tag.

`latest` is convenient for learning but less reproducible than immutable version tags or Git commit SHA tags. For production, prefer immutable tags and deploy the exact tag built by CI.

## 5. GitHub Actions configuration

The provided configuration is `.github/workflows/ci-cd.yaml`. It assumes Dockerfiles are at `backend/Dockerfile` and `frontend/Dockerfile`, the Docker Hub repositories are named as above, and the images are public or Kubernetes has registry pull credentials.

```yaml
name: Task Manager CI/CD

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: task-manager-main-deploy
  cancel-in-progress: false

jobs:
  build-and-push:
    name: Build and push Docker images
    runs-on: ubuntu-latest
    steps:
      - name: Checkout source code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push backend
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          file: ./backend/Dockerfile
          push: true
          tags: mruday033/task-manager-backend:latest

      - name: Build and push frontend
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          push: true
          tags: mruday033/task-manager-frontend:latest

  deploy-to-kubernetes:
    name: Deploy to Kubernetes
    runs-on: self-hosted
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    env:
      KUBECONFIG: /home/ubuntu/.kube/task-manager-config
      K8S_NAMESPACE: task-manager
    steps:
      - name: Verify Kubernetes access
        run: |
          kubectl get deployments -n "$K8S_NAMESPACE"
          kubectl auth can-i patch deployments -n "$K8S_NAMESPACE"

      - name: Configure image pull policy
        run: |
          kubectl patch deployment backend -n "$K8S_NAMESPACE" \\
            --type=strategic \\
            -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","imagePullPolicy":"Always"}]}}}}'
          kubectl patch deployment frontend -n "$K8S_NAMESPACE" \\
            --type=strategic \\
            -p '{"spec":{"template":{"spec":{"containers":[{"name":"frontend","imagePullPolicy":"Always"}]}}}}'

      - name: Restart application deployments
        run: |
          kubectl rollout restart deployment/backend -n "$K8S_NAMESPACE"
          kubectl rollout restart deployment/frontend -n "$K8S_NAMESPACE"

      - name: Wait for rollouts
        run: |
          kubectl rollout status deployment/backend -n "$K8S_NAMESPACE" --timeout=180s
          kubectl rollout status deployment/frontend -n "$K8S_NAMESPACE" --timeout=180s

      - name: Show deployed images and Pods
        run: |
          kubectl get deployments -n "$K8S_NAMESPACE" \\
            -o custom-columns='NAME:.metadata.name,READY:.status.readyReplicas,IMAGES:.spec.template.spec.containers[*].image'
          kubectl get pods -n "$K8S_NAMESPACE" -o wide
```

## 6. Namespace-scoped Kubernetes RBAC

Use a dedicated ServiceAccount and namespace-scoped Role instead of cluster-admin. Example `kubernetes/06-cd-rbac.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: task-manager-deployer
  namespace: task-manager
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: task-manager-deployer
  namespace: task-manager
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch", "patch"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["replicasets"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: task-manager-deployer
  namespace: task-manager
subjects:
  - kind: ServiceAccount
    name: task-manager-deployer
    namespace: task-manager
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: task-manager-deployer
```

Apply and verify with an administrator account:

```bash
kubectl apply -f kubernetes/06-cd-rbac.yaml
kubectl auth can-i patch deployments \
  --as=system:serviceaccount:task-manager:task-manager-deployer \
  -n task-manager
```

Expected result: `yes`.

## 7. Runner kubeconfig

The runner process runs as `ubuntu`, so ensure the workflow's kubeconfig path exists and is readable by that user:

```bash
sudo ls -ld /home/ubuntu/.kube
sudo ls -l /home/ubuntu/.kube/task-manager-config
```

Recommended permissions:

- `/home/ubuntu/.kube`: owned by `ubuntu`, mode `700`.
- `/home/ubuntu/.kube/task-manager-config`: owned by `ubuntu`, mode `600`.

Test with the same user and file path as the workflow:

```bash
sudo -u ubuntu env \
  KUBECONFIG=/home/ubuntu/.kube/task-manager-config \
  kubectl get deployments -n task-manager

sudo -u ubuntu env \
  KUBECONFIG=/home/ubuntu/.kube/task-manager-config \
  kubectl auth can-i patch deployments -n task-manager
```

Expected: deployments are listed and the permission check returns `yes`.

**Credential warning:** a ServiceAccount token stored in a Kubernetes Secret can be long-lived. Keep the kubeconfig private, never print it in workflow logs, and rotate/revoke it if exposed. Do not copy `/etc/kubernetes/admin.conf` into the runner account.

## 8. Application access

Check Service and Pod status:

```bash
kubectl get svc -n task-manager
kubectl get pods -n task-manager -o wide
kubectl get endpoints frontend -n task-manager
```

The frontend NodePort should be accessible at:

```text
http://<EC2-PUBLIC-IP>:30080
```

The EC2 Security Group must allow inbound TCP `30080` from your intended client IP. Prefer your own public IP `/32` instead of `0.0.0.0/0`.

For temporary local testing on EC2:

```bash
kubectl port-forward -n task-manager svc/frontend 8080:80 --address 127.0.0.1
```

In another terminal:

```bash
curl -I http://127.0.0.1:8080
```

To view it from Windows, open an SSH tunnel (replace the key path and IP):

```powershell
ssh -i "YOUR-KEY.pem" -L 8080:127.0.0.1:8080 ubuntu@<EC2-PUBLIC-IP>
```

Then open `http://localhost:8080` on your computer. Keep the port-forward and SSH tunnel running while testing.

## 9. Test a release

1. Make a small frontend or backend code change.
2. Commit and push to `main`.
3. Open **GitHub → Actions**.
4. Confirm **Build and push Docker images** succeeds.
5. Confirm **Deploy to Kubernetes** starts afterward and succeeds.
6. Verify from EC2:

```bash
kubectl get deployments -n task-manager
kubectl get pods -n task-manager
kubectl rollout history deployment/backend -n task-manager
kubectl rollout history deployment/frontend -n task-manager
kubectl get deployments -n task-manager \
  -o custom-columns='NAME:.metadata.name,IMAGES:.spec.template.spec.containers[*].image'
```

A successful rollout confirms the Deployment became available, but still test the UI and relevant API endpoints to validate application behavior.

## 10. Troubleshooting

### Kubeconfig permission denied

```bash
ps -eo user,pid,args | grep '[R]unner.Listener'
```

Ensure `KUBECONFIG` matches the actual runner user and a file that user can read. Do not use `chmod 777` on the kubeconfig.

### Kubernetes API connection failure

Run `kubectl` as the runner user with the same `KUBECONFIG`. Ensure the configured API endpoint is reachable from the EC2 host and its CA certificate matches the API server.

### RBAC returns `no`

Check the ServiceAccount, Role, RoleBinding, namespace, and current kubeconfig identity. The deployment identity should only have namespace-scoped permissions.

### Image pull failure

```bash
kubectl describe pods -n task-manager
kubectl get events -n task-manager --sort-by=.lastTimestamp
```

Verify the images exist in Docker Hub and are public, or configure Kubernetes image-pull credentials. Confirm the build job succeeded before CD starts.

### Rollout timeout

```bash
kubectl rollout status deployment/backend -n task-manager
kubectl rollout status deployment/frontend -n task-manager
kubectl describe deployment backend -n task-manager
kubectl describe deployment frontend -n task-manager
kubectl logs deployment/backend -n task-manager
kubectl logs deployment/frontend -n task-manager
```

Look for startup errors, failed probes, missing environment variables, image pull errors, or resource constraints.

### Browser cannot reach the app

Check NodePort `30080`, frontend endpoints, EC2 Security Group inbound rules, and the instance's current public IP. Port forwarding is useful for testing, but a NodePort normally does not require manual `kubectl port-forward` for external access.

## 11. Security recommendations

- Store Docker Hub access tokens in GitHub Actions secrets.
- Keep the ServiceAccount namespace-scoped; do not use cluster-admin.
- Treat a self-hosted runner as a sensitive host: workflow code can affect the host and read files accessible to its Linux user.
- Do not run untrusted pull-request code on the deployment runner.
- Never print tokens or kubeconfig contents in workflow logs.
- Prefer immutable image tags (for example, a Git commit SHA) for production releases; `latest` is mutable and makes rollbacks less predictable.
- Use protected branches, required reviews, and a rollback plan for production.
- Back up persistent database data before production changes.

## 12. Environment assumptions

| Setting | Value |
|---|---|
| Branch | `main` |
| Namespace | `task-manager` |
| Docker Hub namespace | `mruday033` |
| Backend image | `mruday033/task-manager-backend:latest` |
| Frontend image | `mruday033/task-manager-frontend:latest` |
| Backend Deployment/container | `backend` / `backend` |
| Frontend Deployment/container | `frontend` / `frontend` |
| Database Deployment | `mysql` |
| Runner label | `self-hosted` |
| Runner Linux user | `ubuntu` |
| Kubeconfig | `/home/ubuntu/.kube/task-manager-config` |
| Frontend NodePort | `30080` |

Verify paths, names, runner labels, and resource names against your actual environment before applying the configuration.

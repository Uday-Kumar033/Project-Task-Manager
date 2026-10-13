# Kubernetes Monitoring on Kind Cluster using Helm, Prometheus & Grafana

## Project Overview

This project demonstrates how to deploy a Kubernetes monitoring stack on a Kind (Kubernetes in Docker) cluster using Helm.

The monitoring stack collects cluster metrics, monitors Kubernetes resources, and provides dashboards for visualizing system performance.

### Tools & Technologies

- **Kind:** Runs a Kubernetes cluster using Docker containers.
- **Helm:** Manages Kubernetes applications using Helm charts.
- **Prometheus:** Collects and stores monitoring metrics.
- **Grafana:** Visualizes metrics through dashboards.
- **Node Exporter:** Collects host-level system metrics.
- **Kube State Metrics:** Provides metrics about Kubernetes resources.

## Architecture

```text
Kind Kubernetes Cluster
          |
          v
  Helm Package Manager
          |
          v
 Prometheus Community
          |
          v
  kube-prometheus-stack
          |
    +-----+------+
    |            |
    v            v
Prometheus    Grafana
    |            |
    v            v
Metrics       Dashboards
    |
    v
Node Exporter
Kube State Metrics
```

## Prerequisites

Ensure the following tools are installed on your Ubuntu EC2 instance:

- Docker
- Kind
- kubectl
- Helm 3 or later
- A running Kind cluster

Verify the cluster:

```bash
kind get clusters
kubectl get nodes
kubectl cluster-info
```

## Step 1: Install Helm

Helm is a package manager for Kubernetes that simplifies the installation and management of applications.

Follow the [official Helm installation documentation](https://helm.sh/docs/intro/install/).

After installation, verify Helm:

```bash
helm version
```

## Step 2: Add and Update the Prometheus Community Helm Repository

Add the Prometheus Community repository:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
```

Update the repository index:

```bash
helm repo update
```

Verify the repository:

```bash
helm repo list
```

Search for the monitoring chart:

```bash
helm search repo prometheus-community/kube-prometheus-stack
```

## Step 3: Create the Monitoring Namespace

```bash
kubectl create namespace monitoring
```

If the namespace already exists, continue to the next step.

Verify:

```bash
kubectl get namespaces
```

## Step 4: Install Prometheus and Grafana

Install the `kube-prometheus-stack` Helm chart:

```bash
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring
```

This chart installs Prometheus, Grafana, Alertmanager, and supporting monitoring components.

Check the Helm release:

```bash
helm list -n monitoring
```

## Step 5: Verify Monitoring Resources

Check the pods:

```bash
kubectl get pods -n monitoring
```

Check deployments and services:

```bash
kubectl get deployments -n monitoring
kubectl get services -n monitoring
```

Wait until the required pods are running and ready. To watch pod status continuously:

```bash
kubectl get pods -n monitoring -w
```

Press `Ctrl+C` to stop watching.

## Step 6: Access Grafana

Check the Grafana service name:

```bash
kubectl get svc -n monitoring
```

For the default release name `monitoring`, forward Grafana's service port:

```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80 --address 0.0.0.0
```

Open Grafana at:

http://localhost:3000

If the command is running on a remote EC2 instance, use an SSH tunnel or another secure access method to reach the forwarded port from your computer.

### Grafana Login Credentials

Username:

```text
admin
```

Retrieve the generated password:

```bash
kubectl get secret -n monitoring monitoring-grafana -o jsonpath="{.data.admin-password}" | base64 --decode
echo
```

Use the retrieved password to log in.

**Security note:** Do not expose Grafana directly to the public internet without appropriate authentication and network restrictions.

## Step 7: Access Prometheus

Check the service name:

```bash
kubectl get svc -n monitoring
```

The Prometheus service is commonly named `monitoring-kube-prometheus-prometheus`. If that is the name in your cluster, run:

```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090 --adress 0.0.0.0
```

Open Prometheus at:

http://localhost:9090

Use PromQL queries to inspect metrics. In Prometheus, navigate to **Status → Targets** to check whether monitoring targets are being scraped successfully.

## Step 8: Monitor Cluster Metrics

In Grafana, explore the preconfigured Kubernetes dashboards to inspect:

- CPU and memory utilization
- Node performance
- Pod and container resource usage
- Kubernetes object status
- Prometheus targets and monitoring health

## Step 9: Useful Helm Commands

List releases:

```bash
helm list -n monitoring
```

Show release details:

```bash
helm status monitoring -n monitoring
```

Update repository metadata:

```bash
helm repo update
```

Upgrade the monitoring stack:

```bash
helm upgrade monitoring prometheus-community/kube-prometheus-stack -n monitoring
```

List available chart versions:

```bash
helm search repo prometheus-community/kube-prometheus-stack --versions
```

## Step 10: Troubleshooting

### Pods are stuck in Pending

```bash
kubectl describe pods -n monitoring
kubectl get events -n monitoring --sort-by=.lastTimestamp
```

Check node resources and available storage.

### Pods are in ImagePullBackOff

```bash
kubectl describe pod <pod-name> -n monitoring
```

Check image availability, network connectivity, and container runtime errors.

### Grafana is not accessible

```bash
kubectl get svc -n monitoring
kubectl get pods -n monitoring
kubectl logs deployment/monitoring-grafana -n monitoring
```

Confirm the service name and port-forward command.

### Check Prometheus logs

```bash
kubectl get pods -n monitoring
kubectl logs <prometheus-pod-name> -n monitoring
```

## Step 11: Uninstall the Monitoring Stack

Remove the Helm release:

```bash
helm uninstall monitoring -n monitoring
```

Delete the namespace if you no longer need its resources:

```bash
kubectl delete namespace monitoring
```

**Warning:** Deleting the namespace removes its resources. Persistent data and custom resources may require additional cleanup.

## References

- [Helm Installation Guide](https://helm.sh/docs/intro/install/)
- [Prometheus Community Helm Charts](https://prometheus-community.github.io/helm-charts)
- [kube-prometheus-stack Documentation](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
- [Kind Documentation](https://kind.sigs.k8s.io/)

## Conclusion

This project demonstrates how to install Helm, configure the Prometheus Community repository, and deploy a Prometheus and Grafana monitoring stack on a Kind Kubernetes cluster. It provides practical experience with Kubernetes observability, Helm chart management, metrics collection, and dashboard-based monitoring.

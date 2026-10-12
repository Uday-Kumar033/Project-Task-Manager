sudo apt update && sudo apt upgrade -y

sudo apt install -y docker.io
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker

# 2. Fetch the absolute compiled binary for KinD from the specific sigs infrastructure path
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# 3. Fetch the absolute compiled binary for kubectl using the explicit dl engine sub-route
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm -f ./kubectl


kind create cluster --name multi-node-cluster --config kind-config.yaml

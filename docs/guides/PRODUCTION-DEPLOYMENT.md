# Production Deployment Guide

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Docker Deployment](#docker-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Traditional Server Deployment](#traditional-server-deployment)
6. [Security Hardening](#security-hardening)
7. [Monitoring & Logging](#monitoring--logging)
8. [Backup & Disaster Recovery](#backup--disaster-recovery)
9. [Performance Tuning](#performance-tuning)
10. [Scaling Strategies](#scaling-strategies)

---

## Pre-Deployment Checklist

### ✅ Security
- [ ] Change all default passwords and secrets
- [ ] Generate strong JWT_SECRET (min 32 characters)
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up rate limiting
- [ ] Enable content moderation
- [ ] Review and harden CORS settings
- [ ] Disable debug/verbose logging

### ✅ Configuration
- [ ] Update .env for production
- [ ] Configure production MongoDB URI
- [ ] Set appropriate timeout values
- [ ] Configure email/notification services
- [ ] Set up backup schedules
- [ ] Configure monitoring endpoints

### ✅ Testing
- [ ] Run full test suite: `npm test`
- [ ] Run voting tests: `npm run test-voting`
- [ ] Load test with expected traffic
- [ ] Verify all integrations work
- [ ] Test backup/restore procedures
- [ ] Simulate failure scenarios

### ✅ Documentation
- [ ] Document deployment procedures
- [ ] Create runbook for common issues
- [ ] Document rollback procedures
- [ ] Update API documentation
- [ ] Create admin user guide

---

## Infrastructure Requirements

### Minimum Production Setup

**Single Server Configuration**:
- **CPU**: 8 cores (16 recommended)
- **RAM**: 32GB (64GB recommended)
- **GPU**: NVIDIA RTX 4070 (8GB VRAM) or better
- **Storage**: 200GB NVMe SSD
- **Network**: 1Gbps
- **OS**: Ubuntu 22.04 LTS

**Cost Estimate**: $150-250/month (cloud) or $2000-4000 (hardware)

### Recommended Production Setup

**Load Balanced Configuration**:
- **App Servers**: 2-3 instances (no GPU required)
  - CPU: 4 cores
  - RAM: 16GB
  - Storage: 50GB SSD

- **GPU Server**: 1-2 instances
  - CPU: 8 cores
  - RAM: 64GB
  - GPU: NVIDIA A100 (40GB) or 2x RTX 4090
  - Storage: 500GB NVMe SSD

- **Database Server**:
  - CPU: 4 cores
  - RAM: 16GB
  - Storage: 500GB SSD (RAID 10)

- **Load Balancer**: Nginx or cloud load balancer

**Cost Estimate**: $1000-2000/month (cloud)

### High Availability Setup

- **App Servers**: 3+ instances across availability zones
- **GPU Servers**: 3+ instances with auto-scaling
- **Database**: MongoDB replica set (3 nodes)
- **Cache**: Redis cluster (3 nodes)
- **Load Balancer**: Multi-zone with health checks
- **CDN**: Cloudflare or AWS CloudFront

**Cost Estimate**: $3000-5000/month (cloud)

---

## Docker Deployment

### 1. Create Dockerfile

```dockerfile
# Dockerfile
FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY multi-agent-chatbot/package*.json ./multi-agent-chatbot/

# Install dependencies
RUN npm install --production
RUN cd multi-agent-chatbot && npm install --production

# Copy application code
COPY . .

# Build frontend
RUN cd multi-agent-chatbot && npm run build

# Expose ports
EXPOSE 3000 3002 3005 3006 3007 3008

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start command
CMD ["npm", "run", "start-with-frontend"]
```

### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: chatbot-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
      MONGO_INITDB_DATABASE: chatbot
    volumes:
      - mongodb_data:/data/db
      - mongodb_config:/data/configdb
    networks:
      - chatbot-network
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: chatbot-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - chatbot-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  ollama:
    image: ollama/ollama:latest
    container_name: chatbot-ollama
    restart: unless-stopped
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    networks:
      - chatbot-network
    healthcheck:
      test: curl -f http://localhost:11434/api/version || exit 1
      interval: 30s
      timeout: 10s
      retries: 3

  chatbot:
    build: .
    container_name: chatbot-app
    restart: unless-stopped
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
      ollama:
        condition: service_healthy
    environment:
      NODE_ENV: production
      MONGODB_URI: mongodb://admin:${MONGO_PASSWORD}@mongodb:27017/chatbot?authSource=admin
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      OLLAMA_API_BASE: http://ollama:11434/api
      JWT_SECRET: ${JWT_SECRET}
      FRONTEND_URL: https://your-domain.com
    ports:
      - "3000:3000"
      - "3002:3002"
    volumes:
      - app_logs:/app/logs
      - app_exports:/app/exports
    networks:
      - chatbot-network
    healthcheck:
      test: curl -f http://localhost:3000/api/health || exit 1
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: chatbot-nginx
    restart: unless-stopped
    depends_on:
      - chatbot
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - chatbot-network

volumes:
  mongodb_data:
  mongodb_config:
  redis_data:
  ollama_data:
  app_logs:
  app_exports:

networks:
  chatbot-network:
    driver: bridge
```

### 3. Create .env.production

```bash
# Create production environment file
cp .env.example .env.production

# Edit with production values
nano .env.production
```

```bash
# Production Environment Variables
NODE_ENV=production

# Database
MONGODB_URI=mongodb://admin:STRONG_PASSWORD@mongodb:27017/chatbot?authSource=admin
REDIS_URL=redis://:STRONG_PASSWORD@redis:6379

# Security
JWT_SECRET=YOUR_VERY_LONG_AND_RANDOM_SECRET_KEY_HERE_MIN_32_CHARS
JWT_EXPIRY=7d

# Ollama
OLLAMA_API_BASE=http://ollama:11434/api
OLLAMA_TIMEOUT=180000

# Ports
MANAGER_PORT=3000
FRONTEND_PORT=3002

# Frontend
FRONTEND_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://your-domain.com/api

# Models
MANAGER_MODEL=llama3:latest
AGENT_1_MODEL=llama3:latest
AGENT_2_MODEL=mistral:latest
AGENT_3_MODEL=phi3:latest
AGENT_4_MODEL=qwen2.5-coder:latest

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
```

### 4. Deploy

```bash
# Build and start
docker-compose -f docker-compose.yml --env-file .env.production up -d

# View logs
docker-compose logs -f chatbot

# Pull models (first time only)
docker exec chatbot-ollama ollama pull llama3
docker exec chatbot-ollama ollama pull mistral
docker exec chatbot-ollama ollama pull phi3
docker exec chatbot-ollama ollama pull qwen2.5-coder

# Check health
curl http://localhost/api/health
```

---

## Kubernetes Deployment

### 1. Create Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: chatbot-prod
```

### 2. Create Secrets

```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: chatbot-secrets
  namespace: chatbot-prod
type: Opaque
stringData:
  mongodb-uri: mongodb://admin:PASSWORD@mongodb-svc:27017/chatbot
  jwt-secret: YOUR_STRONG_JWT_SECRET
  redis-password: YOUR_REDIS_PASSWORD
```

### 3. MongoDB Deployment

```yaml
# mongodb-deployment.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
  namespace: chatbot-prod
spec:
  serviceName: mongodb-svc
  replicas: 3
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
      - name: mongodb
        image: mongo:7
        ports:
        - containerPort: 27017
        env:
        - name: MONGO_INITDB_ROOT_USERNAME
          value: "admin"
        - name: MONGO_INITDB_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: chatbot-secrets
              key: mongodb-password
        volumeMounts:
        - name: mongodb-data
          mountPath: /data/db
  volumeClaimTemplates:
  - metadata:
      name: mongodb-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 100Gi
---
apiVersion: v1
kind: Service
metadata:
  name: mongodb-svc
  namespace: chatbot-prod
spec:
  clusterIP: None
  selector:
    app: mongodb
  ports:
  - port: 27017
```

### 4. Ollama Deployment (GPU Node)

```yaml
# ollama-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
  namespace: chatbot-prod
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      nodeSelector:
        gpu: "nvidia"
      containers:
      - name: ollama
        image: ollama/ollama:latest
        ports:
        - containerPort: 11434
        resources:
          limits:
            nvidia.com/gpu: 1
          requests:
            memory: "16Gi"
            cpu: "4"
        volumeMounts:
        - name: ollama-data
          mountPath: /root/.ollama
      volumes:
      - name: ollama-data
        persistentVolumeClaim:
          claimName: ollama-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: ollama-svc
  namespace: chatbot-prod
spec:
  selector:
    app: ollama
  ports:
  - port: 11434
    targetPort: 11434
```

### 5. Chatbot Application

```yaml
# chatbot-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chatbot
  namespace: chatbot-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chatbot
  template:
    metadata:
      labels:
        app: chatbot
    spec:
      containers:
      - name: chatbot
        image: your-registry/chatbot:v3.1.0
        ports:
        - containerPort: 3000
        - containerPort: 3002
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: chatbot-secrets
              key: mongodb-uri
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: chatbot-secrets
              key: jwt-secret
        - name: OLLAMA_API_BASE
          value: "http://ollama-svc:11434/api"
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: chatbot-svc
  namespace: chatbot-prod
spec:
  type: LoadBalancer
  selector:
    app: chatbot
  ports:
  - name: api
    port: 3000
    targetPort: 3000
  - name: frontend
    port: 3002
    targetPort: 3002
```

### 6. Ingress (HTTPS)

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: chatbot-ingress
  namespace: chatbot-prod
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - your-domain.com
    secretName: chatbot-tls
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: chatbot-svc
            port:
              number: 3000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: chatbot-svc
            port:
              number: 3002
```

### 7. Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -f mongodb-deployment.yaml
kubectl apply -f ollama-deployment.yaml
kubectl apply -f chatbot-deployment.yaml
kubectl apply -f ingress.yaml

# Check status
kubectl get pods -n chatbot-prod
kubectl get svc -n chatbot-prod

# View logs
kubectl logs -f deployment/chatbot -n chatbot-prod

# Scale up
kubectl scale deployment/chatbot --replicas=5 -n chatbot-prod
```

---

## Traditional Server Deployment

### 1. Prepare Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Install PM2
sudo npm install -g pm2
```

### 2. Deploy Application

```bash
# Create application user
sudo useradd -m -s /bin/bash chatbot
sudo usermod -aG sudo chatbot

# Clone repository
sudo -u chatbot git clone https://github.com/your-repo/multi-agent-chatbot-system /home/chatbot/app
cd /home/chatbot/app

# Install dependencies
sudo -u chatbot npm install --production
cd multi-agent-chatbot
sudo -u chatbot npm install --production
sudo -u chatbot npm run build
cd ..

# Create production .env
sudo -u chatbot cp .env.example .env
sudo -u chatbot nano .env
# Edit with production values

# Pull models
ollama pull llama3
ollama pull mistral
ollama pull phi3
ollama pull qwen2.5-coder
```

### 3. Configure PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'chatbot-backend',
      script: './start-stable.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '2G',
      restart_delay: 4000,
      autorestart: true
    },
    {
      name: 'chatbot-frontend',
      script: 'npm',
      args: 'start',
      cwd: './multi-agent-chatbot',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    }
  ]
};
```

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save

# Setup PM2 startup script
pm2 startup
# Run the command it outputs

# Monitor
pm2 monit
```

### 4. Configure Nginx

```nginx
# /etc/nginx/sites-available/chatbot
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeouts for AI responses
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # WebSocket timeouts
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Security Hardening

### 1. System Security

```bash
# Enable firewall
sudo ufw enable
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw status

# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd

# Install fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 2. Application Security

```bash
# Strong JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET" >> .env

# Secure MongoDB
mongosh
use admin
db.createUser({
  user: "admin",
  pwd: "STRONG_PASSWORD",
  roles: ["root"]
})

# Enable auth in MongoDB
sudo nano /etc/mongod.conf
# Add:
security:
  authorization: enabled
sudo systemctl restart mongod
```

### 3. Rate Limiting

```javascript
// Already configured in manager/index.js
// Adjust as needed for production

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit per IP
  message: 'Too many requests'
});
```

---

## Monitoring & Logging

### 1. Setup Log Rotation

```bash
# /etc/logrotate.d/chatbot
/home/chatbot/app/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 chatbot chatbot
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 2. Monitoring with Prometheus

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'chatbot'
    static_configs:
      - targets: ['localhost:3099']
```

### 3. Alerting

```bash
# Setup email alerts for critical issues
# Configure in monitoring dashboard or PagerDuty
```

---

## Backup & Disaster Recovery

### 1. Database Backups

```bash
# Create backup script
# /home/chatbot/backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="mongodb://admin:PASSWORD@localhost:27017/chatbot?authSource=admin" --out="/backups/mongo_$DATE"
find /backups -type d -mtime +7 -exec rm -rf {} \;

# Add to crontab
crontab -e
0 2 * * * /home/chatbot/backup.sh
```

### 2. Application Backups

```bash
# Backup configuration and code
tar -czf /backups/app_$(date +%Y%m%d).tar.gz /home/chatbot/app --exclude=node_modules --exclude=logs
```

### 3. Restore Procedures

```bash
# Restore MongoDB
mongorestore --uri="mongodb://admin:PASSWORD@localhost:27017" --drop /backups/mongo_20251202/

# Restore application
tar -xzf /backups/app_20251202.tar.gz -C /
cd /home/chatbot/app
npm install
pm2 restart all
```

---

## Performance Tuning

### 1. Node.js Optimization

```bash
# Increase Node.js memory limit
NODE_OPTIONS=--max-old-space-size=4096 pm2 start ecosystem.config.js

# Enable cluster mode (if no GPU operations)
# ecosystem.config.js
{
  instances: 'max',
  exec_mode: 'cluster'
}
```

### 2. MongoDB Optimization

```javascript
// Connection pooling
mongoose.connect(uri, {
  maxPoolSize: 50,
  minPoolSize: 10
});

// Indexes
db.conversations.createIndex({ userId: 1, createdAt: -1 });
db.conversations.createIndex({ "messages.timestamp": 1 });
```

### 3. Caching

```bash
# Increase cache size in production
CACHE_TTL=600000  # 10 minutes
MAX_CACHE_SIZE=500
```

---

## Scaling Strategies

### Vertical Scaling
- Upgrade to more powerful GPU (RTX 4090, A100)
- Increase RAM and CPU cores
- Faster NVMe storage

### Horizontal Scaling
- Add more app servers (load balanced)
- Add more GPU servers (agent pool)
- MongoDB replica set
- Redis cluster

### Auto-Scaling (Kubernetes)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: chatbot-hpa
  namespace: chatbot-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: chatbot
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

**Last Updated**: December 2, 2025
**Version**: 3.1.0

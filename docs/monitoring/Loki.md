### Установка Loki

- Установка
```bash
apt-get update
apt-get install -y curl gnupg2 software-properties-common
curl -fsSL https://packages.grafana.com/gpg.key | gpg --dearmor | tee /usr/share/keyrings/grafana.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/grafana.gpg] https://packages.grafana.com/oss/deb stable main" | tee /etc/apt/sources.list.d/grafana.list
apt-get update
```

- Подготовка окружения
```bash 
mkdir -p /var/lib/loki/{chunks,index,index_cache}
chown -R loki /var/lib/loki
```

- Установить `nginx` и `certbot`
```bash
apt-get install -y nginx python3-certbot-nginx
```

- `vi /etc/nginx/sites-available/loki.mcarov.pro`
```conf
server {
    server_name loki.mcarov.pro;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    access_log /var/log/nginx/loki.mcarov.pro.access.log;
    error_log /var/log/nginx/loki.mcarov.pro.error.log;

}
```

```bash 
ln -s /etc/nginx/sites-available/loki.mcarov.pro /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

```bash
certbot --nginx -d loki.mcarov.pro
```

- Добавить в `/etc/crontab`
```bash
0 0,12 * * * root /opt/certbot/bin/python -c 'import random; import time; time.sleep(random.random() * 3600)' && sudo certbot renew -q
```

- Базовая аутентификация
```bash
apt install apache2-utils  
mkdir -p /etc/nginx/loki
htpasswd -c /etc/nginx/loki/.htpasswd admin
```

```conf
# Добавить в конфиг nginx
auth_basic "Loki auth";
auth_basic_user_file /etc/nginx/loki/.htpasswd; 
```
```bash 
nginx -t 
systemctl reload nginx
```

- Проверка
```bash 
curl http://127.0.0.1:3100/ready
```

### Конфигурация Loki

### Установка Minio

[Сначала идём по доке](https://min.io/docs/minio/linux/operations/install-deploy-manage/deploy-minio-single-node-single-drive.html)
!!! warn "Установка Minio в режиме Single-Node Single-Drive подходит только для тестовых окружений"

- Настроим TLS
```bash 
certbot certonly --standalone -w /var/www/html -d minio.mcarov.pro
mkdir -p /home/minio-user/.minio/certs
cp /etc/letsencrypt/live/minio.mcarov.pro/fullchain.pem /home/minio-user/.minio/certs/public.crt
cp /etc/letsencrypt/live/minio.mcarov.pro/privkey.pem  /home/minio-user/.minio/certs/private.key
chown minio-user:minio-user /home/minio-user/.minio/certs/{public.crt,private.key}
```

- `vi /etc/letsencrypt/renewal-hooks/post/minio-copy-certs.sh`
```bash
#!/bin/bash
cp /etc/letsencrypt/live/minio.mcarov.pro/privkey.pem /etc/minio/certs/private.key
cp /etc/letsencrypt/live/minio.mcarov.pro/fullchain.pem /etc/minio/certs/public.crt
chown minio-user:minio-user /etc/minio/certs/*
chmod 600 /etc/minio/certs/*
systemctl restart minio
```

```bash 
chmod +x /etc/letsencrypt/renewal-hooks/post/minio-copy-certs.sh
```

- `vi /etc/default/minio`
```bash
MINIO_OPTS="--address minio.mcarov.pro:8443 --console-address minio.mcarov.pro:9443"
```

- `vi /etc/nginx/sites-available/minio.mcarov.pro`
```bash
server {
    listen 443 ssl;
    server_name minio.mcarov.pro;

    ssl_certificate /etc/letsencrypt/live/minio.mcarov.pro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/minio.mcarov.pro/privkey.pem;

    return 301 https://minio.mcarov.pro:9443$request_uri;
}

server {
    listen 80;
    server_name minio.mcarov.pro;
    return 301 https://minio.mcarov.pro:9443$request_uri;
}

```

```bash 
nginx -t
ln -s /etc/nginx/sites-available/minio.mcarov.pro /etc/nginx/sites-enabled/
systemctl reload nginx
```

!!! tip "Не забудь про фаервол"     

```bash 
systemctl daemon-relod
systemctl start minio
systemctl enable minio
```

### Vector

- Установка
```bsh
bash -c "$(curl -L https://setup.vector.dev)"
```

```bash
sudo apt-get install vector
```

```bash
systemctl enable --now vector
```
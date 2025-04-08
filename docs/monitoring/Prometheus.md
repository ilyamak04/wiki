### Установка Prometheus server и Node exporter

#### Prometheus server install

- `wget https://github.com/prometheus/prometheus/releases/download/v2.55.0-rc.0/prometheus-2.55.0-rc.0.linux-amd64.tar.gz` - скачиваем прометеус сервер
- `tar xvfz *.tar.gz`
- `cd prometheus-2.55.0-rc.0.linux-amd64.tar.gz`
- `sudo mv prometheus /usr/local/bin/`
- `sudo mv promtool /usr/local/bin`
- `sudo mkdir /etc/prometheus/`
- `sudo mkdir /etc/prometheus/data`
- `sudo mv prometheus.yml /etc/prometheus/`

```yml
# prometheus.yml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          # - alertmanager:9093

# Load rules once and periodically evaluate them according to the global 'evaluation_interval'.
rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]
        
  - job_name: "archers-paradox-servers"
    static_configs:
      - targets:
          - 89.22.241.241:9100
```

- `useradd -rs /bin/false prometheus` - создаём системного пользователя для работы с prometheus
- `chown prometheus:prometheus /usr/local/bin/prometheus` 
- `chown -R prometheus:prometheus /etc/prometheus` 
- `vi /etc/systemd/system/prometheus.service` - создаём systemd юнит

```bash
[Unit]
Description=Prometheus Server
After=network.target

[Service]
User=prometheus
Group=prometheus
Type=simple
Restart=on-failure
RestartSec=4s
ExecStart=/usr/local/bin/prometheus \
  --config.file       /etc/prometheus/prometheus.yml \
  --storage.tsdb.path /etc/prometheus/data

[Install]
WantedBy=multi-user.target
```

- `sudo systemctl daemon-reload` - обновить systemd
- `sudo systemctl start prometheus`
- `sudo systemctl enable prometheus`

#### Настройка TLS

- `touch web-config.yml` - создать конфигурационный файл для настойки TLS

- Добавить в Unit-файл пусть к конфигу TLS в директиве `ExecStart` 
```bash
ExecStart=/usr/local/bin/prometheus \
  --config.file       /etc/prometheus/prometheus.yml \
  --storage.tsdb.path /etc/prometheus/data \
  --web.config.file /etc/prometheus/web-config.yml
```

- `certbot certonly --nginx -d prometheus.mcarov.pro` - сгенирировать сертификаты, команду не хочу пояснять

!!! tip "Если на сервере нет Nginx"
  `certbot certonly --standalone -d prometheus.mcarov.pro`


- Добавить Серт и Ключ в `web-config.yml`
```
tls_server_config:
  cert_file: /home/prometheus/certs/example.com/example.com.crt
  key_file: /home/prometheus/certs/example.com/example.com.key
```

- Добавить строку в `/etc/crontab` для обновления серта
```
0 0,12 * * * root /opt/certbot/bin/python -c 'import random; import time; time.sleep(random.random() * 3600)' && sudo certbot renew -q
```

- Создать скрипт `/etc/letsencrypt/renewal-hooks/deploy/set-permissions-and-restart-prometheus.sh` 
```bash
#!/bin/bash
# Выдать права пользователю prometheus
setfacl -R -m u:prometheus:rX /etc/letsencrypt/

# Перезагрузить Prometheus
systemctl restart prometheus
```
- `chmod +x /etc/letsencrypt/renewal-hooks/deploy/set-permissions-and-restart-prometheus.sh`

- `certbot renew --dry-run` - для отладки процесса обновления сертификатов

- Создать конфиг nginx в `/etc/nginx/sites-available` 
```
server {
    server_name prometheus.mcarov.pro;

    location / {
        client_max_body_size 512M;
        proxy_pass https://127.0.0.1:9090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    access_log /var/log/nginx/prometheus.mcarov.pro.access.log;
    error_log /var/log/nginx/prometheus.mcarov.pro.error.log;

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/prometheus.mcarov.pro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prometheus.mcarov.pro/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

}

server {
    if ($host = prometheus.mcarov.pro) {
        return 301 https://$host$request_uri;
    }


    listen 80;
    server_name prometheus.mcarov.pro;
    return 404;

}
```
- `ln -s /etc/nginx/sites-available/prometheus.mcarov.pro /etc/nginx/sites-enabled/`
- `nginx -t`
- `systemctl reload nginx`

#### Аутентификация для Prometheus Server

- `htpasswd -nBC 10 "" | tr -d ':\n'` - выполнить

- Добавить в `web-config.yml`
```yml
basic_auth_users:
  # user: password (hash)
  admin: $2y$10$QzpQ2fO9TpU1Hm4VbB6AMO8ZsdoplfesfAmI8MFB402BVIu5gf.TK
```
-  `systemctl restart prometheus`

- В UI Grafana настроить Basic auth в Data Source

#### Node exporter install
- `wget https://github.com/prometheus/node_exporter/releases/download/v1.8.2/node_exporter-1.8.2.linux-arm64.tar.gz` - скачиваем node exporter на удалённый хост

- `tar xvfz *.tar.gz`
- `sudo mv node_exporter /usr/local/bin/`

-  `sudo useradd -rs /bin/false node_exporter`
-  `sudo chown node_exporter:node_exporter /usr/local/bin/node_exporter`
- `sudo vi /etc/systemd/system/node_exporter.service`

```bash
# node_exporter.service
[Unit]
Description=Prometheus Node Exporter
After=network.target 

[Service]
User=node_exporter
Group=node_exporter
Type=simple
Restart=on-failure
RestartSec=4s
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
```

- `sudo systemctl daemon-reload`
- `sudo systemctl start node_exporter`
- `sudo systemctl enable node_exporter`

#### Настройка TLS

- `touch web.yml`
- Создать `openssl.cnf` и наполнить содержимым:
```
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn

[dn]
CN = 150.241.66.94

[v3_ext]
authorityKeyIdentifier=keyid,issuer:always
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=@alt_names

[alt_names]
IP.1 = 150.241.66.94
```

- `sudo openssl req -x509 -newkey rsa:2048 -keyout node_exporter.key -out node_exporter.pem -days 36500 -nodes -config openssl.cnf -extensions v3_ext` - генирируем серты

- Не забываем выдать права на сертификаты

- Добавить в `web.yml`
```
tls_server_config:
  cert_file: /etc/prometheus/node_exporter/certs/node_exporter.pem
  key_file: /etc/prometheus/node_exporter/certs/node_exporter.key
```

- Добавить в Unit Node Exporter в директиву ExecStart
```bash
--web.config.file=/etc/prometheus/node_exporter/web.yml
```

- `systemctl daemon-reload`
- `systemctl restart node_exporter.service`

- На машине с Prometheus Server добавить в `prometheus.yml` в нужную джобу экспортера
```
  scheme: https
  tls_config:
    ca_file: /etc/prometheus/node_exporter/srv-infra/certs/node_exporter.pem
```

- `systemctl restart prometheus`

### Про PromQL
- `increase()` возвращает общий прирост за указанный интервал времени.
```
increase(<метрика>[<интервал>])
```
- `rate()` вычисляет скорость изменения за этот же интервал времени, и в результате возвращает количество изменений в секунду.
- `increase(http_requests_total[5m])` — покажет, сколько запросов пришло за последние 5 минут.
- `rate(http_requests_total[5m])` — покажет среднее количество запросов в секунду за последние 5 минут.

### Полезности

- `promtool check config prometheus.yml`- проверка синтаксиса
- `promtool check rules rules.yml` - проверка синтаксиса
- `promtool test rules rules_test.yml`
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

### Telegraf 

- `telegraf --test --config /etc/telegraf/telegraf.conf --input-filter tail` - запустить телеграф в режиме отладки


### PostgreSQL Exporter 

- Создать пользователя для мониторинга
```sql
CREATE USER postgres_exporter WITH PASSWORD 'password';
ALTER USER postgres_exporter SET SEARCH_PATH TO pg_catalog;
GRANT CONNECT ON DATABASE postgres TO postgres_exporter;
GRANT USAGE ON SCHEMA pg_catalog  TO postgres_exporter;
GRANT EXECUTE ON FUNCTION pg_ls_waldir TO postgres_exporter;
GRANT pg_read_all_stats TO postgres_exporter;
```

- Установить Exporter
```bash
wget https://github.com/prometheus-community/postgres_exporter/releases/download/v0.17.1/postgres_exporter-0.17.1.linux-amd64.tar.gz
tar -xzvf postgres_exporter-0.17.1.linux-amd64.tar.gz
rm postgres_exporter-0.17.1.linux-amd64.tar.gz
cd postgres_exporter-0.17.1.linux-amd64/
mv postgres_exporter /usr/local/bin/
cd ..
rm -rf postgres_exporter-0.17.1.linux-amd64/
chmod +x /usr/local/bin/postgres_exporter
/usr/local/bin/postgres_exporter --version
```

- Добавить в `postgresql.conf`
```conf
ssl = on
ssl_cert_file = '/etc/postgresql/ssl/server.crt'
ssl_key_file = '/etc/postgresql/ssl/server.key'
ssl_ca_file = '/etc/postgresql/ssl/root.crt'
```

- Сгенирировать серты, включая корневой (самоподписные)
```bash
mkdir -p /etc/postgresql/ssl
chown postgres:postgres /etc/postgresql/ssl
chmod 700 /etc/postgresql/ssl

openssl genrsa -out /etc/postgresql/ssl/root.key 4096
openssl req -x509 -new -nodes -key /etc/postgresql/ssl/root.key -sha256 -days 3650 \
  -out /etc/postgresql/ssl/root.crt \
  -subj "/CN=PostgreSQL Root CA"
chmod 600 /etc/postgresql/ssl/root.key


openssl genrsa -out /etc/postgresql/ssl/server.key 2048
openssl req -new -key /etc/postgresql/ssl/server.key -out /etc/postgresql/ssl/server.csr \
  -subj "/CN=$(hostname)"
openssl x509 -req -in /etc/postgresql/ssl/server.csr -CA /etc/postgresql/ssl/root.crt \
  -CAkey /etc/postgresql/ssl/root.key -CAcreateserial -out /etc/postgresql/ssl/server.crt \
  -days 3650 -sha256
chmod 600 /etc/postgresql/ssl/server.key
chown postgres:postgres /etc/postgresql/ssl/server.*

systemctl restart postgresql
```

- Ограничить в `pg_hba.conf` доступ для пользователя `postgres_exporter`
```conf
hostssl  postgres  postgres_exporter  127.0.0.1/32  scram-sha-256
```

- Конфигурируем клиент
```bash
useradd -r -s /bin/false postgres_exporter
chown -R postgres_exporter:postgres_exporter /etc/postgres_exporter 
chmod 600 /etc/postgres_exporter/*

mkdir -p /etc/postgres_exporter
cp /etc/postgresql/ssl/root.crt /etc/postgres_exporter/
chmod 700 /etc/postgres_exporter
chmod 400 /etc/postgres_exporter/root.crt
```

- Конфигурируем systemd
```bash 
# Файл /etc/postgres_exporter/env
DATA_SOURCE_NAME=postgresql://postgres_exporter:password@127.0.0.1:5432/postgres?sslmode=verify-ca&sslrootcert=/etc/postgres_exporter/root.crt
```
```bash
# Файл /etc/systemd/system/postgres_exporter.service
[Unit]
Description=PostgreSQL Exporter for Prometheus
After=network.target

[Service]
User=postgres_exporter
Group=postgres_exporter
EnvironmentFile=/etc/postgres_exporter/env
ExecStart=/usr/local/bin/postgres_exporter

[Install]
WantedBy=multi-user.target
```

- Добавить в prometheus.yml
```yml
- job_name: 'postgres_exporter'
  static_configs:
    - targets: ['localhost:9187']
```

```bash
systemctl restart prometheus
```

### MariaDB Exporter 

#### На сервере MariaDB

- Создать файл `openssl.cnf`
```conf
[ req ]
prompt             = no
distinguished_name = req_distinguished_name
req_extensions     = v3_req

[ req_distinguished_name ]
CN = 89.22.228.13

[ v3_req ]
keyUsage         = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName   = @alt_names

[ alt_names ]
DNS.1 = mariadb.mcarov.pro
IP.1  = 89.22.228.13
```

- Создаём серты
```bash
mkdir -p /etc/mysql/ssl

openssl req -x509 -new -nodes -days 3650 \
  -subj "/CN=MyMariaDB-CA" \
  -keyout /etc/mysql/ssl/ca-key.pem \
  -out /etc/mysql/ssl/ca.pem \
  -sha256 -days 3650

openssl req -new -nodes -newkey rsa:2048 \
  -keyout /etc/mysql/ssl/server-key.pem \
  -out /etc/mysql/ssl/server.csr \
  -config openssl.cnf

openssl x509 -req -in /etc/mysql/ssl/server.csr \
  -CA /etc/mysql/ssl/ca.pem -CAkey /etc/mysql/ssl/ca-key.pem \
  -CAcreateserial \
  -out /etc/mysql/ssl/server-cert.pem \
  -days 3650 -sha256 \
  -extensions v3_req -extfile openssl.cnf
```

- В конфиге MariaDB
```conf
[mysqld]
ssl-ca=/etc/mysql/ssl/ca.pem
ssl-cert=/etc/mysql/ssl/server-cert.pem
ssl-key=/etc/mysql/ssl/server-key.pem
```
```bash
sudo systemctl restart mariadb
```

- Создать в базе пользователя экспортера
```sql
CREATE USER 'mariadb_exporter'@'192.109.139.92' IDENTIFIED BY 'mariadb_exporter';
GRANT SELECT, PROCESS, REPLICATION CLIENT, RELOAD ON *.* TO 'mariadb_exporter'@'192.109.139.92' IDENTIFIED BY 'mariadb_exporter';
FLUSH PRIVILEGES;
```

#### На сервере Exporter 

- Ставим экспортер на вм, где есть Pronetheus Server
```bash
wget https://github.com/prometheus/mysqld_exporter/releases/download/v0.17.2/mysqld_exporter-0.17.2.linux-amd64.tar.gz
tar -xzvf mysqld_exporter-0.17.2.linux-amd64.tar.gz
rm mysqld_exporter-0.17.2.linux-amd64.tar.gz
mv mysqld_exporter-0.17.2.linux-amd64/mysqld_exporter /usr/local/bin
  chmod +x /usr/local/bin/mysqld_exporter
```

- Создаём пользователя для экспортера
```bash 
useradd -r -s /usr/sbin/nologin mariadb_exporter
mkdir -p /etc/mariadb_exporter
chown -R mariadb_exporter:mariadb_exporter /etc/mariadb_exporter
```

- Создать `/etc/mariadb_exporter/.my.cnf`
```conf
[client]
user=mariadb_exporter
password=mariadb_exporter
host=89.22.228.14
ssl-ca=/etc/mariadb_exporter/ca.pem
ssl-verify-server-cert
```
```bash
chown -R mariadb_exporter:mariadb_exporter /etc/mariadb_exporter
```

- Создаём Unit-файл 
```conf
[Unit]
Description=Prometheus MariaDB Exporter
After=network.target

[Service]
User=mariadb_exporter
Group=mariadb_exporter
ExecStart=/usr/local/bin/mysqld_exporter \
  --config.my-cnf=/etc/mariadb_exporter/.my.cnf
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
```bash 
systemctl daemon-reload
systemctl enable --now mariadb_exporter
```

- Добавляем в `prometheus.yml`
```yml
- job_name: 'mariadb_exporter'
  static_configs:
    - targets: ['localhost:9104']
```

- Проверка 
```bash 
curl http://localhost:9104/metrics
```

## Alerts

### Устанавливаем `Alertmanager`

```bash
useradd -r -s /usr/sbin/nologin alertmanager

wget https://github.com/prometheus/alertmanager/releases/download/v0.28.1/alertmanager-0.28.1.linux-amd64.tar.gz
tar -xzvf alertmanager-*.tar.gz
mv alertmanager-*/alertmanager /usr/local/bin/
mv alertmanager-*/amtool /usr/local/bin/
chown alertmanager:alertmanager /usr/local/bin/alertmanager 
chown alertmanager:alertmanager /usr/local/bin/amtool
rm -rf alertmanager-*
```

- Подготовка 
```bash
mkdir -p /etc/alertmanager
mkdir -p /var/lib/alertmanager
chown -R alertmanager:alertmanager /etc/alertmanager /var/lib/alertmanager
```

- Файл `/etc/alertmanager/alertmanager.yml`
```yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 1h
  receiver: 'default-receiver'

receivers:
- name: 'default-receiver'
  webhook_configs:
  - url: 'http://localhost:9093/-/healthy'  # временный URL для теста
    send_resolved: true
```

- Файл `/etc/systemd/system/alertmanager.service`
```conf
[Unit]
Description=Alertmanager
Wants=network-online.target
After=network-online.target

[Service]
User=alertmanager
Group=alertmanager
Type=simple
ExecStart=/usr/local/bin/alertmanager \
  --config.file=/etc/alertmanager/alertmanager.yml \
  --storage.path=/var/lib/alertmanager
Restart=always

[Install]
WantedBy=multi-user.target
```
```bash
systemctl daemon-reload
systemctl enable --now alertmanager
systemctl status alertmanager  
```

#### HTTPS Alertmanager

- `vi /etc/nginx/sites-available/alertmanager.mcarov.pro`
```conf
server {
    listen 80;
    server_name alertmanager.mcarov.pro;

    location / {
        proxy_pass http://127.0.0.1:9093;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
ln -s /etc/nginx/sites-available/alertmanager.mcarov.pro /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```
```bash
certbot --nginx -d alertmanager.mcarov.pro
```

- Аутентификация
```bash
htpasswd -c /etc/nginx/alertmanager/.htpasswd admin
```
```conf
# Добавить в кофиг nginx
auth_basic "Alertmanager";
auth_basic_user_file /etc/nginx/alertmanager/.htpasswd;
```
```bash
nginx -t
systemctl reload nginx
```

### Настройка алертов

- Добавить `Alertmanager` в `prometheus.yml`
```yml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']
```
```bash
systemctl restart prometheus
```

- Проверка
```
# Должен вернуть ОК
curl http://localhost:9093/-/healthy
amtool check-config /etc/alertmanager/alertmanager.yml
```



- Создай бота в телеграм, создай чат, добавь его в чат
- Получи `chat-id`
!!! warning ""
  В чате должно быть минимум 1 сообщения
```bash 
curl "https://api.telegram.org/bot<BOT_TOKEN>/getUpdates" | jq
```

- `/etc/alertmanager/templates/telegram.tmpl`
```
{{ define "telegram.critical.message" }}
{{ if eq .Status "firing" }}
🔥 *[CRITICAL ALERT]* {{ .CommonLabels.alertname }}
📌 **Instance**: {{ .CommonLabels.instance }}
🕒 **Firing since**: {{ (.Alerts.Firing | first).StartsAt.Format "2006-01-02 15:04:05" }}
📝 **Summary**: {{ .CommonAnnotations.summary }}

{{ .CommonAnnotations.description }}
{{ if .CommonAnnotations.runbook }}🔗 **Runbook**: {{ .CommonAnnotations.runbook }}{{ end }}
{{ else }}
✅ *[CRITICAL RESOLVED]* {{ .CommonLabels.alertname }}
📌 **Instance**: {{ .CommonLabels.instance }}
🕒 **Resolved at**: {{ (.Alerts.Resolved | first).EndsAt.Format "2006-01-02 15:04:05" }}
📝 **Summary**: {{ .CommonAnnotations.summary }}
{{ end }}
{{ end }}

{{ define "telegram.warning.message" }}
{{ if eq .Status "firing" }}
⚠️ *[WARNING]* {{ .CommonLabels.alertname }}

{{ .CommonAnnotations.summary }}
**Details**: {{ .CommonAnnotations.description }}
{{ else }}
✅ *[WARNING RESOLVED]* {{ .CommonLabels.alertname }}
📝 {{ .CommonAnnotations.summary }}
{{ end }}
{{ end }}

{{ define "telegram.db.message" }}
{{ if eq .Status "firing" }}
🛠 *[DB ALERT]* {{ .CommonLabels.alertname }} ({{ .CommonLabels.service }})

{{ .CommonAnnotations.description }}
**Action required**: {{ .CommonAnnotations.runbook }}
{{ else }}
✅ *[DB ALERT RESOLVED]* {{ .CommonLabels.alertname }} ({{ .CommonLabels.service }})
📝 {{ .CommonAnnotations.summary }}
{{ end }}
{{ end }}

{{ define "telegram.default.message" }}
{{ if eq .Status "firing" }}
ℹ️ *[ALERT]* {{ .CommonLabels.alertname }}

{{ .CommonAnnotations.summary }}
{{ .CommonAnnotations.description }}
{{ else }}
✅ *[ALERT RESOLVED]* {{ .CommonLabels.alertname }}
📝 {{ .CommonAnnotations.summary }}
{{ end }}
{{ end }}
```

- `/etc/alertmanager/alertmanager.yml`
```yml
global:
  resolve_timeout: 5m
  http_config:
    follow_redirects: true

templates:
  - '/etc/alertmanager/templates/*.tmpl'

route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'telegram-default'

  routes:
    - match:
        severity: 'critical'
      receiver: 'telegram-critical'
      continue: false
      group_interval: 15m
      repeat_interval: 2h

    - match:
        severity: 'warning'
      receiver: 'telegram-warnings'
      group_interval: 1h
      repeat_interval: 12h

    - match_re:
        service: 'mysql|postgres|influx'
      receiver: 'telegram-db-team'

inhibit_rules:
- source_match:
    severity: 'critical'
  target_match:
    severity: 'warning'
  equal: ['alertname']

receivers:
- name: 'telegram-critical'
  telegram_configs:
  - bot_token: 'BOT_TOKEN'
    chat_id: CHAT_ID
    parse_mode: 'Markdown'
    message: '{{ template "telegram.critical.message" . }}'
    send_resolved: true

- name: 'telegram-warnings'
  telegram_configs:
  - bot_token: 'BOT_TOKEN'
    chat_id: CHAT_ID
    parse_mode: 'Markdown'
    message: '{{ template "telegram.warning.message" . }}'
    send_resolved: true

- name: 'telegram-db-team'
  telegram_configs:
  - bot_token: 'BOT_TOKEN'
    chat_id: CHAT_ID
    parse_mode: 'Markdown'
    message: '{{ template "telegram.db.message" . }}'
    send_resolved: true

- name: 'telegram-default'
  telegram_configs:
  - bot_token: 'BOT_TOKEN'
    chat_id: CHAT_ID
    parse_mode: 'Markdown'
    message: '{{ template "telegram.default.message" . }}'
    send_resolved: true
```
```bash
# проверка конфига
amtool check-config /etc/alertmanager/alertmanager.yml
# проверка шаблонов
amtool check-config /etc/alertmanager/alertmanager.yml --template-files /etc/alertmanager/templates/*.tmpl
```
```bash
systemctl restart prometheus alertmanager
```

- `/etc/prometheus/rules/*_rules.yml`
```yml
groups:
- name: Infrastructure
  rules:
  # CPU
  - alert: HighCpuUsage
    expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100 > 80
    for: 10m
    labels:
      severity: warning
      category: infra
    annotations:
      summary: "High CPU usage on {{ $labels.instance }}"
      description: "CPU usage is {{ $value }}% for 10 minutes."

  # Memory
  - alert: HighMemoryUsage
    expr: (1 - (node_memory_MemAvailable_bytes / (node_memory_MemTotal_bytes))) * 100 > 85
    for: 15m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage on {{ $labels.instance }}"
      description: "Memory usage is {{ $value }}% for 15 minutes."

  # Disk
  - alert: LowDiskSpace
    expr: (node_filesystem_avail_bytes{mountpoint=~"/|/var", fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint=~"/|/var"} * 100) < 15
    for: 10m
    labels:
      severity: critical
    annotations:
      summary: "Low disk space on {{ $labels.mountpoint }} ({{ $labels.instance }})"
      description: "Only {{ printf \"%.2f\" $value }}% space left on {{ $labels.mountpoint }}."

  # Network
  - alert: HighNetworkErrors
    expr: rate(node_network_transmit_errs_total[2m]) + rate(node_network_receive_errs_total[2m]) > 10
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Network errors on {{ $labels.instance }}"

- name: ServiceHealth
  rules:
  # Service Availability
  - alert: ServiceDown
    expr: up == 0
    for: 3m
    labels:
      severity: critical
    annotations:
      summary: "Service {{ $labels.job }} down on {{ $labels.instance }}"
      description: "The service has been down for more than 3 minutes."

- name: PrometheusMonitoring
  rules:
  # Prometheus self-monitoring
  - alert: PrometheusDown
    expr: up{job="prometheus"} == 0
    for: 5m
    labels:
      severity: critical
      category: monitoring
    annotations:
      summary: "Prometheus is unreachable"
      description: "Prometheus is up==0 for more than 5 minutes."

  # Exporter monitoring (Node Exporter)
  - alert: NodeExporterDown
    expr: up{job="node"} == 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Node Exporter down on {{ $labels.instance }}"

  # Alertmanager monitoring
  - alert: AlertmanagerDown
    expr: up{job="alertmanager"} == 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Alertmanager is unreachable"
```
```bash
# проверить
promtool check rules /etc/prometheus/rules/*.yml
```

### Blackbox Exporter

- Создаём пользователя
```bash
useradd --no-create-home --shell /usr/sbin/nologin blackbox_exporter
```

- Устанавливаем
```bash
wget https://github.com/prometheus/blackbox_exporter/releases/download/v0.26.0/blackbox_exporter-0.26.0.linux-amd64.tar.gz
tar -xzvf blackbox_exporter-0.26.0.linux-amd64.tar.gz
mv blackbox_exporter-0.26.0.linux-amd64/blackbox_exporter /usr/local/bin/
chown blackbox_exporter:blackbox_exporter /usr/local/bin/blackbox_exporter
rm -rf blackbox_exporter*
```

- Структура конфига `Blackbox exporter`
```bash
modules:
  <module_name>:
    prober: <type>
    <type_specific_settings>
```

- Конфигурируем экспортер
```bash
mkdir /etc/blackbox_exporter
```

- `vi /etc/blackbox_exporter/blackbox.yml`
```yml
modules:
  http_2xx:
    prober: http
    timeout: 5s
    http:
      valid_status_codes:
        - 200
        - 201
        - 202
        - 203
        - 204
        - 205
        - 206
        - 207
        - 208
        - 226

  http_auth_2xx:
    prober: http
    timeout: 5s
    http:
      headers:
        # логин:пароль в base64 (echo -n login:pass | base64)
        Authorization: "Basic YWRtRTc0fakehashfdVnZldWE=" 
      valid_status_codes:
        - 200
        - 201
        - 202
        - 203
        - 204
        - 205
        - 206
        - 207
        - 208
        - 226

  tcp_connect:
    prober: tcp
    timeout: 5s

  postgres_tcp:
    prober: tcp
    tcp:
      tls: false

  mariadb_tcp:
    prober: tcp
    tcp:
      query_response:
        - expect: "^"
      tls: false

  vm_icmp:
    prober: icmp
    timeout: 3s
```

```bash
chown -R blackbox_exporter:blackbox_exporter /etc/blackbox_exporter
```

- `vi /etc/systemd/system/blackbox_exporter.service`
```bash
[Unit]
Description=Prometheus Blackbox Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=blackbox_exporter
Group=blackbox_exporter
AmbientCapabilities=CAP_NET_RAW
CapabilityBoundingSet=CAP_NET_RAW
Type=simple
ExecStart=/usr/local/bin/blackbox_exporter \
  --config.file=/etc/blackbox_exporter/blackbox.yml \
  --web.listen-address="127.0.0.1:9115"
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

- Запускаем экспортер
```bash
systemctl daemon-reload
systemctl enable --now blackbox_exporter
systemctl status blackbox_exporter
```

- Проверка
```bash 
curl http://127.0.0.1:9115/metrics
```

- Настроим доступ к экспортеру по HTTPS `vi /etc/nginx/sites-available/blackbox.mcarov.pro`
```bash
server {
    server_name blackbox.mcarov.pro;

    location / {
        proxy_pass http://127.0.0.1:9115;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    access_log /var/log/nginx/blackbox.mcarov.pro.access.log;
    error_log /var/log/nginx/blackbox.mcarov.pro.error.log;
}
```

```bash 
ln -s /etc/nginx/sites-available/blackbox.mcarov.pro /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

```bash
certbot --nginx -d blackbox.mcarov.pro
```

- Добавить в `/etc/crontab` для обновления сертов
```bash
0 0,12 * * * root /opt/certbot/bin/python -c 'import random; import time; time.sleep(random.random() * 3600)' && sudo certbot renew -q
```

- Базовая аутентификация
```bash
apt install apache2-utils  
mkdir -p /etc/nginx/blackbox
htpasswd -c /etc/nginx/blackbox/.htpasswd admin
```

```conf
# Добавить в конфиг nginx
auth_basic "Blackbox auth";
auth_basic_user_file /etc/nginx/blackbox/.htpasswd; 
```

```bash 
nginx -t 
systemctl reload nginx
```

- `vi /etc/prometheus/prometheus.yml`
```yml 
  - job_name: 'blackbox-http'
    metrics_path: /probe
    scheme: https
    basic_auth:
      username: 'admin'
      password: 'password'
    tls_config:
      insecure_skip_verify: false
    params:
      module: [http_2xx]
    static_configs:
      - targets:
        - https://grafana.mcarov.pro
        - https://git.mcarov.pro
        - https://wiki.mcarov.pro
        - https://minio.mcarov.pro
        - https://influx.mcarov.pro/ping
    relabel_configs: &relabel
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox.mcarov.pro

  - job_name: 'blackbox-http-auth'
    metrics_path: /probe
    scheme: https
    basic_auth:
      username: 'admin'
      password: 'password'
    tls_config:
      insecure_skip_verify: false
    params:
      module: [http_auth_2xx]
    static_configs:
      - targets:
          - https://alertmanager.mcarov.pro
          - https://prometheus.mcarov.pro
          - https://blackbox.mcarov.pro
    relabel_configs: *relabel

  - job_name: 'postgres-check'
    metrics_path: /probe
    scheme: https
    basic_auth:
      username: 'admin'
      password: 'password'
    tls_config:
      insecure_skip_verify: false
    params:
      module: [postgres_tcp]
    static_configs:
      - targets:
        - 127.0.0.1:5432
    relabel_configs: *relabel

  - job_name: 'mariadb-check'
    metrics_path: /probe
    scheme: https
    basic_auth:
      username: 'admin'
      password: 'password'
    tls_config:
      insecure_skip_verify: false
    params:
      module: [mariadb_tcp]
    static_configs:
      - targets:
        - 89.22.28.13:3306
    relabel_configs: *relabel

  - job_name: 'vm-ping'
    metrics_path: /probe
    scheme: https
    basic_auth:
      username: 'admin'
      password: 'password'
    tls_config:
      insecure_skip_verify: false
    params:
      module: [vm_icmp]
    static_configs:
      - targets:
        - 192.10.139.92
        - 150.21.66.94
        - 89.2.228.13
    relabel_configs: *relabel
```

#### ура, Алерты для блэкбокс

- `vi blackbox_alerts.yml`
```yml
groups:
- name: blackbox_exporter_alerts
  rules:
  - alert: ServiceDown
    expr: probe_success == 0
    for: 2m
    labels:
      severity: critical
    annotations:
      summary:   "Сервис {{ $labels.instance }} недоступен"
      description: |
        Сервис {{ $labels.instance }} (job={{ $labels.job }})
        не отвечает уже более 2 минут.

  - alert: HighLatency
    expr: probe_success == 1 and avg_over_time(probe_duration_seconds[1m]) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary:   "Высокая задержка у {{ $labels.instance }}"
      description: |
        Сервис {{ $labels.instance }} (job={{ $labels.job }}) отвечает медленно:
        probe_duration_seconds={{ printf "%.3f" $value }}s (больше 1s)
        уже более 5 минут.

  - alert: BlackboxSslCertificateWillExpireSoon
    expr: 0 <= round((last_over_time(probe_ssl_earliest_cert_expiry[10m]) - time()) / 86400, 0.1) < 3
    for: 0m
    labels:
      severity: warning
    annotations:
      summary: "TLS-сертификат истёкает для {{ $labels.instance }}"
      description: |
        Срок действия TLS-сертификата для {{ $labels.instance }} истёкает через 3 дня.


  - alert: TLSCertificateExpired
    expr: round((last_over_time(probe_ssl_earliest_cert_expiry[10m]) - time()) / 86400, 0.1) < 0
    for: 0m
    labels:
      severity: critical
    annotations:
      summary: "TLS-сертификат истёк для {{ $labels.instance }}"
```

```bash
chown prometheus:prometheus /etc/prometheus/rules/blackbox_alerts.yml
```

- Добавить в `prometheus.yml`
```bash
rule_files:
  - 'rules/blackbox_alerts.yml'
```

- `promtool check config /etc/prometheus/prometheus.yml`- проверка синтаксиса
- `promtool check rules /etc/prometheus/rules/blackbox_alerts.yml` - проверка синтаксиса
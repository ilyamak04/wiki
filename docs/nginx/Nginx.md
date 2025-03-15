### root vs alias

#### root

Добавляет URL к указанному пути.

```
location /images/ {
    root /var/www/myapp/static/;
}
```

Если запрошен URL `/images/photo.jpg`, Nginx будет искать файл по пути `/var/www/myapp/static/images/photo.jpg`.

#### alias

Заменяет часть URL на указанный путь.

```
location /images/ {
    alias /var/www/myapp/static/;
}
```

Если запрошен URL `/images/photo.jpg`, Nginx будет искать файл по пути `/var/www/myapp/static/photo.jpg`.

В `alias` корреткно не работают регулярки

!!! tip ""
    Не забывай добавлять `/` в конце строки в директиве `location`

### Директивы

#### http

Блок `http` используется для настройки параметров, связанных с обработкой HTTP-запросов.

#### server

Блок `server` определяет виртуальный сервер (хост). Внутри этого блока настраиваются параметры для обработки запросов к определенному домену или IP-адресу.

- `listen`: Порт и IP-адрес, на котором сервер будет принимать запросы.
- `server_name`: Имя сервера (домен или поддомен). `server_name _`: Nginx использует этот блок server как сервер по умолчанию для запросов, которые не соответствуют другим блокам `server`.
- `location`: Блоки для обработки конкретных URL.

#### map

```
map $переменная $новая_переменная {
    значение1 результат1;
    значение2 результат2;
    default   результат_по_умолчанию;
}
```

```
map $remote_addr $backend {
    192.168.1.100  backend_special;  # Для конкретного IP
    default        backend_default;  # По умолчанию
}

upstream backend_default {
    server 192.168.1.1;
}

upstream backend_special {
    server 192.168.1.2;
}

server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://$backend;
    }
}
```

#### Разное

- `upstream`: Используется для настройки балансировки нагрузки между несколькими серверами
```
http {
    upstream backend {
        server 192.168.1.1;
        server 192.168.1.2;
    }

    server {
        listen 80;
        server_name example.com;

        location / {
            proxy_pass http://backend;
        }
    }
}
```

- `include`: Позволяет подключать дополнительные конфигурационные файлы
- `error_page`: Настройка страниц ошибок
- `access_log` и `error_log`: Настройка логов

---

Директива `worker_processes` определяет количество процессов (worker processes), которые Nginx будет использовать для обработки запросов. При значение `auto` Nginx автоматически определяет оптимальное количество worker-процессов на основе количества ядер CPU. Каждый worker-процесс может обрабатывать множество соединений (зависит от параметра `worker_connections`).

---

Блок `location`

- `root`: Корневая директория для поиска файлов.
- `alias`: Замена части URL на другой путь.
- `proxy_pass`: Перенаправление запросов на другой хост.
- `try_files`: Попытка найти файл по указанному пути.

---

`access_log` глобально задать нельзя. Можно переопределять на уровне `http`, `server` или `location`.
`error_log` можно задать глобально. Можно переопределять на уровне `http`, `server` или `location`.

---


```
# Передаёт backend-серверу доменное имя хоста из запроса клиента
proxy_set_header Host $host;
# Передаёт backend-серверу ip-адрес клиента
proxy_set_header X-Real-IP $remote_addr;
# Передаёт цепочку прокси-серверов, через которые прошёл запрос и добавляет в конец реальный ip-адрес клиента
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
# Передаёт backend-серверу протокол, который использовал клиент (например, http или https)
proxy_set_header X-Forwarded-Proto $scheme;
```

#### http-заголовки

- `add_header` Добавляет произвольный заголовок в ответ сервера
- `proxy_hide_header` Удаляет заголовки, которые передаются от проксируемого сервера
- `proxy_set_header` Позволяет изменять или добавлять HTTP-заголовки, которые Nginx передаёт проксируемому серверу. Добавляет заголовок, если его нет. Перезаписывает, если он уже есть.
- `set_header` Аналогично proxy_set_header, но используется для других типов запросов (не только прокси).
- `proxy_pass_header` Разрешает передачу определённых заголовков клиенту (если они были скрыты по умолчанию).
- `server_tokens off;` Отключает вывод версии Nginx в заголовке Server.
- `etag on|off;` Включает или отключает генерацию заголовка ETag для статических файлов.
- `if_modified_since` Управляет поведением заголовка If-Modified-Since.
- `expires` Устанавливает заголовок Expires для управления кэшированием.
    `expires 1h;`  # Кэшировать на 1 час
    `expires max;` # Кэшировать на максимальный срок

- Модуль `ngx_headers_more` Предоставляет дополнительные возможности для работы с заголовками
    `more_set_headers` — добавляет или изменяет заголовки.
    `more_clear_headers` — удаляет заголовки.
    `more_set_input_headers` — изменяет заголовки входящих запросов.
    `more_clear_input_headers` — удаляет заголовки входящих запросов.

#### Cache-Control

- `add_header Cache-Control` -  это HTTP-заголовок, который указывает, как и насколько долго контент может кэшироваться.

!!! info ""
    Браузеры и прокси-серверы будут кэшировать контент в соответствии с Cache-Control.

    Очистка кэша:
    Если файл изменился, нужно изменить его имя или добавить версию (например, style-v2.css).

    Cache-Control имеет приоритет над устаревшим заголовком Expires.

##### Параметры Cache-Control

- `public` - указывает, что контент может кэшироваться любыми кэширующими устройствами, включая браузеры, прокси-серверы, CDN
- `max-age` - ремя (в секундах), на которое контент может быть кэширован
- `private` - Контент может кэшироваться только в браузере, но не на прокси-серверах
- `must-revalidate` - Кэш должен проверять актуальность контента на сервере после истечения max-age
- `no-store` - Контент не должен кэшироваться.
- `no-transform` - Запрещает промежуточным прокси-серверам изменять контент (например, сжимать изображения или изменять кодировку). Прокси-серверы обязаны передавать контент в оригинальном виде.
- `immutable` - Браузер кэширует контент и помечает его как "неизменяемый" на время, указанное в max-age. При повторном запросе браузер не отправляет запрос на сервер для проверки актуальности. Браузер просто использует кэшированную версию.
- `no-cache` - Браузер кэширует контент, но помечает его как "требующий проверки". При повторном запросе браузер отправляет на сервер запрос с заголовками (If-None-Match: Значение ETag (уникальный идентификатор контента). If-Modified-Since: Время последнего изменения контента.) Сервер проверяет: Если контент не изменился, сервер возвращает 304 Not Modified, и браузер использует кэшированную версию. Если контент изменился, сервер возвращает новый контент с 200 OK.


### Проксирование

Когда Nginx получает запрос от клиента, он не изменяет заголовки по умолчанию. Однако, если Nginx выступает в роли прокси (используется proxy_pass), он может изменить или удалить некоторые заголовки.

При проксировании Nginx передаёт следующие заголовки:

- `Host` - По умолчанию Nginx передаёт заголовок Host из запроса клиента, но если используется proxy_pass, Nginx может заменить Host на IP-адрес backend-сервера, если не указано иное.
- `Connection` - Nginx автоматически добавляет или изменяет заголовок Connection для управления keepalive-соединениями (значение заголовка: `keep-alive`, `close`)
- `X-Real-IP`
- `X-Forwarded-For`
- `X-Forwarded-Proto`

Nginx автоматически добавляет заголовки `X-Forwarded-For`, `X-Real-IP` и `X-Forwarded-Proto`, если они не указаны явно.

Остальные заголовки не передаются, если не указаны явно с помощью `proxy_set_header`.

### Переменные в Nginx

- `$host` - доменное имя сервера и порт (если указан), содержит значение заголовка Host из запроса клиента
- `$content_type` - значение заголовка `Content-Type` из запроса клиента
- `$content_length` - значение заголовка `Content-Length` из запроса клиента
- `$remote_addr` - ip-адрес клиента, который сделал запрос
- `$scheme` - протокол запроса
- `$request_method` - http метод запроса
- `$request_uri` - полный URL запроса 
- `$uri` - URL без параметров
- `$args` - параметры запроса, часть после `?`
- `$cookie_*` - переменные для доступа к кукам, из запроса клиента.
- `$http_*` - переменные для доступа к любым HTTP-заголовкам, из запроса клиента.
    - `$http_user_agent` — заголовок User-Agent.
    - `$http_referer` — заголовок Referer.
- `$server_name` - значение, указанное в директиве server_name в конфигурации Nginx
- `$server_port` - порт на который пришел запрос
- `$status` - http статус ответа
- `$upstream_*` -  содержат информацию о взаимодействии Nginx с backend-серверами (upstream)
    - `$upstream_addr` - IP-адрес и порт backend-сервера, который обработал запрос
    - `$upstream_status` - HTTP-статус ответа от backend-сервера
    - `$upstream_response_time` - Время, которое backend-сервер потратил на обработку запроса (в секундах)
    - `$upstream_header_*` - Заголовки, полученные от backend-сервера.

### Уровни логирования 

1. `debug`: Отладочные сообщения (самый подробный уровень).
2. `info`: Информационные сообщения.
3. `notice`: Важные, но не критические события.
4. `warn`: Предупреждения.
5. `error`: Ошибки (например, проблемы с конфигурацией).
6. `crit`: Критические ошибки.
7. `alert`: Ещё более критические ошибки.
8. `emerg`: Аварийные ситуации (Nginx не работает).

```
user  nginx;
worker_processes  auto;
error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on; # использование системного вызова sendfile Вместо того чтобы читать файл в память и затем отправлять его клиенту, Nginx использует sendfile, чтобы передать файл напрямую из файловой системы в сетевой интерфейс.
    keepalive_timeout  120; # секунд держится открытым соединение
    keepalive_requests 10000; # запросов можно отправить в открытое соединение
    server_tokens off; # Отключает отображение версии Nginx в HTTP-заголовках и страницах ошибок.

    # Сжатие
    gzip on; # Включает сжатие gzip.
    gzip_types text/plain text/css application/json application/javascript  text/javascript application/pdf application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; # Указывает типы файлов, которые нужно сжимать
    gzip_min_length 1000; # Сжимает только файлы размером больше 1000 байт. Мелкие файлы сжимать неэффективно
    gzip_comp_level 5; # Устанавливает уровень сжатия. Значение 5 — это баланс между скоростью и степенью сжатия. (gzip от 1 до 9)
    gzip_proxied any; # Cжатие для проксируемые запросов
    gzip_vary on; # Добавляет заголовок Vary: Accept-Encoding, чтобы прокси-серверы правильно кэшировали сжатые и несжатые версии файлов.
    gzip_disable "msie6"; # Отключает сжатие для старых версий Internet Explorer (6 и ниже)

    server {

        # TLS
        listen 443 ssl;
        http 2 on;
        server_name ${DOMAIN};

        ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
        ssl_trusted_certificate /etc/letsencrypt/live/${DOMAIN}/chain.pem; # Предоставляет цепочку доверия для проверки OCSP-ответов

        ssl_protocols TLSv1.3; # Разрешает только TLS 1.3 (самая современная и безопасная версия TLS).
        ssl_prefer_server_ciphers on; # Указывает, что сервер выбирает шифры, а не клиент
        ssl_session_timeout 1d; # ремя жизни SSL-сессии — 1 день. Это позволяет повторно использовать SSL-сессии для уменьшения нагрузки на сервер.
        ssl_session_cache shared:MozSSL:10m; # размер кэша для SSL-сессий
        ssl_early_data on; # В TLS 1.3 клиент может отправить данные до завершения полного рукопожатия, если он уже подключался к серверу ранее
        ssl_session_tickets off; # Отключает TLS session tickets (устаревший механизм, который может быть уязвим).

        # требуется ssl_trusted_certificate
        ssl_stapling on; # Включает OCSP stapling. Сервер сам проверяет статус сертификата и отправляет клиенту, что ускоряет загрузку.
        ssl_stapling_verify on; # Включает проверку OCSP ответов

        # Безопасность
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Content-Security-Policy "default-src 'self';" always;

        # Проксирование
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }

        
        location / {
            proxy_pass http://frontend:1234;
        }

        # Прокси для API и admin
        location /api/ {
            proxy_pass http://backend:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme; 
        }
        
        location /admin/ {
            proxy_pass http://backend:8000;
        }
        
        location /django_static/ {
            alias /app/staticfiles/;
            access_log off;
            etag on; # это уникальный идентификатор файла, который используется для проверки, изменился ли файл на сервере
            if_modified_since exact; # Указывает Nginx использовать точное сравнение времени модификации файла (вместо учета возможных погрешностей)
            add_header Cache-Control "max-age=31536000, public, no-transform, no-cache";     
        }
    }

    server {
        listen 80;
        server_name ${DOMAIN};
        return 301 https://$host$request_uri;
    }
}

```

### Древовидная схема архитектуры Nginx

```
/ (корневая директория)
│
├── etc/
│   └── nginx/                     # Основная конфигурация Nginx
│       ├── nginx.conf             # Главный конфигурационный файл
│       ├── conf.d/                # Дополнительные конфигурационные файлы
│       │   └── example.conf       # Конфигурация для конкретного сайта
│       ├── sites-available/       # Доступные конфигурации сайтов
│       │   └── example.com        # Конфигурация для example.com
│       ├── sites-enabled/         # Активированные конфигурации сайтов (симлинки на sites-available)
│       │   └── example.com -> ../sites-available/example.com
│       ├── modules-available/     # Доступные модули
│       ├── modules-enabled/       # Активированные модули (симлинки на modules-available)
│       ├── mime.types             # MIME-типы файлов
│       ├── fastcgi.conf           # Конфигурация FastCGI
│       ├── proxy_params           # Параметры проксирования
│       └── snippets/              # Общие фрагменты конфигурации
│           └── ssl.conf           # Настройки SSL
│
├── var/
│   └── www/                       # Корневая директория для сайтов
│       ├── html/                  # Стандартная директория для статических файлов
│       │   └── index.html         # Стандартный индексный файл
│       └── example.com/           # Директория для сайта example.com
│           ├── public_html/       # Корневая директория сайта
│           │   └── index.html     # Индексный файл сайта
│           └── logs/              # Логи сайта
│               ├── access.log     # Лог доступа
│               └── error.log      # Лог ошибок
│
├── usr/
│   └── lib/
│       └── nginx/                 # Модули и бинарные файлы Nginx
│           ├── modules/           # Динамически загружаемые модули
│           └── nginx              # Исполняемый файл Nginx
│
└── run/
    └── nginx.pid                  # PID-файл Nginx (хранит ID процесса)
```

### Введение

Кратенько опишу как развернуть свой сайтик с помощью MkDocs

MkDocs умеет конвертировать файлы `.md` формата в красивую статику 

У меня есть [репа](https://github.com/ilyamak04/wiki) на гитхабе с заметками, я собираюсь превратить её в веб-сайт

Реализуем схему: при пуше в master-ветку целевого репозитория, сайт будет обновляться соответсвующей информацией

Работаю на Ubuntu

### Устанавливаем runner

Я все делаю с помощью гитхаба, раннер и веб-сайт будут находится на одном сервере

- `cd /opt` - будем устанавливать github runner в `/opt`
- добавляем runner для репозитория ([дока](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners#adding-a-self-hosted-runner-to-a-repository)) 
- `useradd --system --shell /usr/sbin/nologin runner` - создаём системного пользователя из-под которого будет работать runner
- `chown runner:runner -R /opt/actions-runner` - делаем созданного пользователя владельцем рабочего каталога
- запустим раннер как systemd сервис ([дока](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/configure-the-application#installing-the-service))

### Подготовка Nginx

MkDocs генерирует статику, а веб-сервер будет её отдавать, реализуем эту схему более менее грамотно

Храним 3 последние версии сайта, при новом коммите создаём новую версию, перемещаем на неё симлинк, удаляем самую старую версию

Получается такая файловая структура веб-сервера
```bash
/var/www/wiki/
  releases/
    20260228120000/
    20260228153000/
    20260301101000/

current -> releases/20260301101000
```

- `mkdir -p /var/www/wiki/releases` - создаём структуру каталогов
- `chown -R root:runner /var/www/wiki` 
- `chmod -R 2775 /var/www/wiki` - назначили setgid, то есь все новые файлы в каталоге наследуют группу runner

- `apt install nginx` - устанавливаем веб-сервер
- `vi /etc/nginx/sites-available/wiki` - пока простейшая конфигурация, потом добавим tls
```bash 
server {
    listen 80;
    server_name wiki.mcarov.ru;

    root /var/www/wiki/current;
    index index.html;

    access_log /var/log/nginx/wiki.access.log;
    error_log  /var/log/nginx/wiki.error.log;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

- `ln -s /etc/nginx/sites-available/wiki /etc/nginx/sites-enabled/`
- `nginx -t`
- `systemctl reload nginx`

- устанавливаем certbot, получаем tls сертификаты от letsencrypt [дока](https://certbot.eff.org/instructions?ws=nginx&os=pip), конечно же у нас должен быть домен, и `A` днс запись для нашего веб-сайта
- не забываем включить автообновление сертификатов
```bash
echo "0 0,12 * * * root /opt/certbot/bin/python -c 'import random; import time; time.sleep(random.random() * 3600)' && sudo certbot renew -q" | sudo tee -a /etc/crontab > /dev/null
```

### CI/CD

- `apt isntall rsync`
- `.github/workflows/mkdocs.yml` - создаём файл в репозитории для пайплайна
- Пайплайн
```yaml
name: Deploy MkDocs

on:
  push:
    branches:
      - master

jobs:
  deploy:
    runs-on: self-hosted

    steps:
      - uses: actions/checkout@v4

      - name: Create venv
        run: |
          python3 -m venv venv
          source venv/bin/activate
          pip install -r requirements.txt

      - name: Build site
        run: |
          source venv/bin/activate
          mkdocs build

      - name: Deploy release
        run: |
          set -e

          RELEASE=$(date +%Y-%m-%d_%H-%M)
          TARGET=/var/www/wiki/releases/$RELEASE

          mkdir -p $TARGET
          rsync -a site/ $TARGET/

          ln -sfn $TARGET /var/www/wiki/current

      - name: Cleanup old releases (keep 3)
        run: |
          cd /var/www/wiki/releases
          ls -dt */ | tail -n +4 | xargs -r rm -rf
```

### Rate limiter

Минимальная безопасность веб-сервера [ссылка](https://selectel.ru/blog/fail2ban/)
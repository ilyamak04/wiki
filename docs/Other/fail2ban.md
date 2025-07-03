### Установка

```bash
sudo apt update && sudo apt install fail2ban -y
```
### Настройка

```bash
# рекомендуется, но необязательно
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local 
```

Для модуля `nginx-linit-req`

- Добавить в блок `http`
```conf
http {
...
limit_req_zone $binary_remote_addr zone=one:10m rate=1r/s;
...
}
```

- Добавить в все `location` для защиты от флуда
```conf 
limit_req zone=one burst=5 nodelay;
```

- `vi /etc/fail2ban/jail.local`
```bash
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = 10001
#Для Debian добавить:
#backend = systemd
# Если в течении 24 часов
findtime = 86400
# произведено 3 неудачных попытки логина,
maxretry = 3
# то банить IP навсегда.
bantime = -1

[nginx-bad-request]
enabled = true
port = http,https
filter = nginx-bad-request
logpath = /var/log/nginx/*access.log
maxretry = 3
findtime = 5m
bantime = 24h

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/*error.log
maxretry = 3
findtime = 5m
bantime = 24h

[nginx-botsearch]
enabled = true
port = http,https
filter = nginx-botsearch
logpath = /var/log/nginx/*access.log
maxretry = 5
findtime = 10m
bantime = 24h

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/*error.log
maxretry = 100
findtime = 30
bantime = 24h
```

- Проверка
```bash 
fail2ban-server -t
fail2ban-client reload
fail2ban-client status
fail2ban-client status sshd    # Статус защиты SSH
fail2ban-client status nginx-bad-reauest
fail2ban-client status nginx-botsearch
fail2ban-client status nginx-http-auth
fail2ban-client status nginx-limit-req
tail -f /var/log/fail2ban.log 
fail2ban-client set <jail> unbanip <IP>	# разбанить ip
fail2ban-regex /var/log/exim4/mainlog /etc/fail2ban/filter.d/exim-spam.conf # проверить срабатывание фильтра
```
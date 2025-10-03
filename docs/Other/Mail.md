https://habr.com/ru/companies/nixys/articles/797971/

https://habr.com/ru/companies/nixys/articles/797971/
https://habr.com/ru/companies/nixys/articles/807681/

Инструкция выполнена на `Debian 12`

### Установка и настройка Exim4 (MTA)

- `apt-get update`
- `apt-get install exim4`

```conf
dc_eximconfig_configtype='internet'
dc_other_hostnames='mcarov.pro'
dc_local_interfaces='127.0.0.1 ; ::1 ; 89.22.228.13'
dc_readhost=''
dc_relay_domains=''
dc_minimaldns='false'
dc_relay_nets=''
dc_smarthost=''
CFILEMODE='644'
dc_use_split_config='false'
dc_hide_mailname=''
dc_mailname_in_oh='true'
dc_localdelivery='mail_spool'
```

-  `/etc/exim4/exim4.conf.template`
```conf 
primary_hostname = mail.mcarov.pro
qualify_domain = mcarov.pro
```

update-exim4.conf && systemctl reload exim4


mcarov.pro. IN MX 10  mail.mcarov.pro
dig MX mcarov.pro +short
10 mail.mcarov.pro.
nc mail.mcarov.pro 25



mcarov.pro. IN TXT "v=spf1 a mx ip4:89.22.228.13 ~all"
dig TXT mcarov.pro +short


Письма, не прошедшие проверку, попадают в спам.
_dmarc.mcarov.pro. IN TXT "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@mcarov.pro; aspf=r; fo=1"
dig +short -ttxt _dmarc.DOMAIN.RU

после тестирования 
Письма, не прошедшие проверку, отклоняются.
_dmarc.mcarov.pro. IN TXT "v=DMARC1; p=reject; pct=100; rua=mailto:dmarc@mcarov.pro; sp=reject; aspf=s; fo=1"
dig TXT _dmarc.mcarov.pro +short

apt install opendkim-tools
mkdir /etc/exim4/dkim
cd /etc/exim/dkim
- vi /etc/exim4/dkim_domain
```conf 
mcarov.pro.: key=/etc/exim4/dkim/scfh.ru.key selector=mail
```


- Далее генерируем публичный и приватный ключ DKIM:
```bash
opendkim-genkey -D /etc/exim4/dkim/ -d mcarov.pro -s mail -b 1024
```

- Для удобства переименуем 
```bash
mv /etc/exim4/dkim/mail.private /etc/exim4/dkim/mcarov.pro.key
mv /etc/exim4/dkim/mail.txt /etc/exim4/dkim/mcarov.pro.txt
```

- Права 
```bash
chown -R root:Debian-exim /etc/exim4/dkim
chmod 750 /etc/exim4/dkim
chmod 640 /etc/exim4/dkim/mcarov.pro.key
chmod 640 /etc/exim4/dkim/mcarov.pro.txt
```

- `vi /etc/exim4/exim4.conf.template` в начало файла
```conf
DKIM_DOMAIN = ${lookup{$sender_address_domain}lsearch*@{/etc/exim4/dkim_domain}{$sender_address_domain}{}}
DKIM_PRIVATE_KEY = ${extract{key}{${lookup{$sender_address_domain}lsearch*@{/etc/exim4/dkim_domain}}}{$value}{}}
DKIM_SELECTOR = ${extract{selector}{${lookup{$sender_address_domain}lsearch*@{/etc/exim4/dkim_domain}}}{$value}{}}
```

- `vi /etc/exim4/exim4.conf.template` 
```conf
remote_smtp:
driver = smtp
dkim_domain       	= DKIM_DOMAIN
dkim_selector     	= mail
dkim_private_key  	= DKIM_PRIVATE_KEY
```



mail._domainkey.mcarov.pro. IN TXT ( "v=DKIM1; h=sha256; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAXXXXXXXXXXXXXXXXXXX/MiksdC/S5Qlsdvdfs+GdNC3gUu/dcUqrgQ9vLRtsdcsdcsdT/zYhfI1OWcni5ssfbut/eltfY5OlXXXXXXXXXXXXXX+W5JP40LoJP3RtZqgj0Ze3bEnQY1dgQIDAQAB" ) ; ----- DKIM key mail for mcarov.pro
dig TXT mail._domainkey.mcarov.pro +short


13.228.22.89.in-addr.arpa. IN PTR mail.mcarov.pro.
dig -x 89.22.228.13


vi /etc/exim4/conf.d/transport/30_exim4-config_dovecot_lmtp
dovecot_lmtp:
  driver            = lmtp
  socket            = /var/run/dovecot/lmtp
  delivery_date_add
  envelope_to_add
  return_path_add

/etc/exim4/conf.d/router/350_exim4-config_virtual_user
virtual_user:
  driver           = accept
  condition        = ${if exists {${lookup mysql{SELECT 1 FROM mailbox \
                      WHERE username='${local_part}@${domain}' AND active='1'}}}{yes}{no}}
  transport        = dovecot_lmtp


/etc/exim4/conf.d/transport/25_exim4-config_submission


certbot certonly --webroot -w /var/www/html -d mail.mcarov.pro
ln -s /etc/letsencrypt/live/mail.mcarov.pro/fullchain.pem /etc/exim4/exim.crt
ln -s /etc/letsencrypt/live/mail.mcarov.pro/privkey.pem /etc/exim4/exim.key

vi /etc/exim4/conf.d/transport/30_exim4-config_dovecot_lmtp

update-exim4.conf
systemctl reload exim4


### Установка и настройка Dovecot

apt install dovecot-core dovecot-imapd dovecot-pop3d dovecot-lmtpd dovecot-sieve

После загрузки приложения вы можете просмотреть, что в директории /etc/dovecot (если не был выбран иной каталог) следующая иерархия файлов:

groupadd -g 5000 vmail
useradd -g vmail -u 5000 vmail -d /var/mail -m -s /sbin/nologin

vi /etc/dovecot/dovecot.conf
listen = *, ::


vi /etc/dovecot/conf.d/10-ssl.conf
ssl = required
ssl_cert = </etc/letsencrypt/live/dovecot.mcarov.pro/fullchain.pem
ssl_key  = </etc/letsencrypt/live/dovecot.mcarov.pro/privkey.pem

/etc/dovecot/conf.d/10-mail.conf
mail_location = maildir:/var/mail/vhosts/%d/%n
mail_privileged_group = mail
first_valid_uid = 5000
first_valid_gid = 5000

/etc/dovecot/conf.d/10-auth.conf
```conf
disable_plaintext_auth = yes
auth_mechanisms = plain login
# Подключает SQL-аутентификацию через внешний файл
!include auth-sql.conf.ext
```

/etc/dovecot/conf.d/auth-sql.conf.ext

passdb {
  driver = sql
  args = /etc/dovecot/dovecot-sql.conf.ext
}
userdb {
  driver = sql
  args = /etc/dovecot/dovecot-sql.conf.ext
}



/etc/dovecot/dovecot-sql.conf.ext
driver = mysql
connect = host=127.0.0.1 dbname=postfix user=postfix password=ТВОЙ_ПАРОЛЬ
default_pass_scheme = MD5
password_query = SELECT username AS user, password FROM mailbox WHERE username = '%u'
user_query = SELECT CONCAT('/var/mail/vhosts/', maildir) AS home, \
  5000 AS uid, 5000 AS gid FROM mailbox WHERE username = '%u' AND active = '1'

/etc/dovecot/conf.d/10-master.conf
service lmtp {
  unix_listener /var/run/dovecot/lmtp {
    mode = 0660
    user = dovecot 
    group = dovecot
  }
}


systemctl restart dovecot

/etc/dovecot/conf.d/10-logging.conf:
/var/log/dovecot.log
/var/log/dovecot-info.log
journalctl -u dovecot
dovecot -n активный конфиг довкот


#service lmtp {
#  unix_listener lmtp {
#mode = 0666
#  }
  # Create inet listener only if you can't use the above UNIX socket
  #inet_listener lmtp {
    # Avoid making LMTP visible for the entire internet
    #address =
    #port =
  #}
#}


### Postfixadmin

apt install  apache2 php php-fpm php-mysql php-intl php-mbstring php-imap php-curl php-xml php-bcmath unzip

CREATE DATABASE postfix;
CREATE USER 'postfix'@'localhost' IDENTIFIED BY 'secret';
GRANT ALL PRIVILEGES ON postfix.* TO 'postfix'@'localhost';
FLUSH PRIVILEGES;



cd /var/www/
wget https://github.com/postfixadmin/postfixadmin/archive/refs/tags/postfixadmin-3.3.13.tar.gz
tar -xzf postfixadmin-3.3.13.tar.gz
mv postfixadmin-postfixadmin-3.3.13 postfixadmin
chown -R www-data:www-data /var/www/postfixadmin

cd /var/www/postfixadmin
mkdir -p templates_c
chown -R www-data:www-data templates_c
chmod 755 templates_c



vi /etc/nginx/sites-available/postfixadmin

server {
    listen 80;
    server_name postfixadmin.mcarov.pro;
    return 301 https://$host$request_uri;
}

server {
    listen 80;
    server_name postfixadmin.mcarov.pro;

    root /var/www/postfixadmin/public;
    index index.php;

    ssl_certificate /etc/letsencrypt/live/postfixadmin.mcarov.pro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/postfixadmin.mcarov.pro/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
    }

    location ~* ^/(config\.inc\.php|\.git) {
        deny all;
    }
}



ln -s /etc/nginx/sites-available/postfixadmin /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx



cp /var/www/postfixadmin/config.inc.php /var/www/postfixadmin/config.local.php
vi /var/www/postfixadmin/config.local.php



<?php
$CONF['configured'] = true;
$CONF['default_language'] = 'en';
$CONF['database_type'] = 'mysqli';
$CONF['database_host'] = 'localhost';
$CONF['database_user'] = 'postfix';
$CONF['database_password'] = 'secret';
$CONF['database_name'] = 'postfix';

$CONF['encrypt'] = 'dovecot:SHA512-CRYPT';
$CONF['domain_path'] = 'YES';
$CONF['domain_in_mailbox'] = 'YES';
$CONF['admin_email'] = 'postmaster@mcarov.pro';
$CONF['setup_password'] = 'HASH_FROM_SETUP';




https://postfixadmin.mcarov.pro/setup.php





cd /var/www/
mkdir rainloop && cd rainloop
wget -O rainloop.zip https://www.rainloop.net/repository/webmail/rainloop-latest.zip
unzip rainloop.zip
chown -R www-data:www-data /var/www/rainloop

vi /etc/nginx/sites-available/rainloop.mcarov.pro

server {
    listen 80;
    server_name rainloop.mcarov.pro;

    root /var/www/rainloop;
    index index.php;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
    }

    location ^~ /data {
        deny all;
        return 403;
    }

    location ~ /\.ht {
        deny all;
    }
}




ln -s /etc/nginx/sites-available/rainloop.mcarov.pro /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx


certbot --nginx -d rainloop.mcarov.pro


chown -R www-data:www-data /var/www/rainloop
chmod -R 755 /var/www/rainloop

admin/12345




 /etc/dovecot/conf.d/10-auth.conf
 # Отключаем системный бэкенд ─ закомментируй строку
#!include auth-system.conf.ext

# Наш SQL остаётся
!include auth-sql.conf.ext



tail -f /var/log/exim4/mainlog
tail -f /var/log/dovecot.log


/etc/dovecot/conf.d/10-master.conf
service auth {
  unix_listener auth-client {
    mode  = 0660
    user  = Debian-exim      # имя системного пользователя Exim
    group = Debian-exim
  }
}


apt install dovecot-mysql




/etc/exim4/exim4.conf.localmacros
daemon_smtp_ports = 25 : 587
tls_on_connect_ports = 465        # если когда-нибудь захочешь SMTPS


RainLoop ──IMAP/993────► Dovecot
        ╲
         ╲ SMTP-AUTH/587
          ╲
           ▼
          Exim ──► (интернет-серверы)          # внешняя отправка
           │
           └─LMTP────────► Dovecot-LDA        # доставка во внутренний ящик


chown -R vmail:mail /var/mail/vhosts
chmod 770 /var/mail/vhosts


doveadm auth test test@mcarov.pro E74Vveua
exim4 -bt test@mcarov.pro
# → router = virtual_user transport = dovecot_lmtp


apt install exim4-daemon-heavy


grep dc_use_split_config /etc/exim4/update-exim4.conf.conf
# должно быть
dc_use_split_config='true'


Веб-логин аутентифицирует вас в самом RainLoop (сеанс HTTP).
Но когда RainLoop открывает SMTP-сеанс к Exim, сервер не знает, кто к нему пришёл, — он требует SMTP-AUTH, чтобы не стать open-relay.


cat >> /etc/exim4/exim4.conf.localmacros <<'EOF'
#
# --- TLS & submission ---
MAIN_TLS_CERTIFICATE = /etc/letsencrypt/live/mail.mcarov.pro/fullchain.pem
MAIN_TLS_PRIVATEKEY  = /etc/letsencrypt/live/mail.mcarov.pro/privkey.pem
MAIN_TLS_ADVERTISE_HOSTS = *
daemon_smtp_ports = 25 : 587
tls_on_connect_ports = 465
EOF


 vi  /etc/exim4/conf.d/transport/25_exim4-config_submission

submission:
  driver         = smtp
  port           = 587
  hosts_require_auth = *






/etc/exim4/conf.d/router/350_exim4-config_virtual_user

virtual_user:
  driver    = accept
  condition = ${if exists {${lookup mysql{ \
    SELECT 1 \
    FROM mailbox \
    WHERE username='${quote_mysql:${local_part}@${domain}}' \
      AND active='1'}}}{yes}{no}}
  transport = dovecot_lmtp


cat >/etc/exim4/conf.d/main/10_exim4-mysql <<'EOF'
hide mysql_servers = 127.0.0.1::3306/postfix/zSQAmej2/postfix
EOF



/etc/exim4/conf.d/router/350_exim4-config_virtual_user

exim
Copy
Edit

############################################
#  Route local virtual mailbox users
############################################
virtual_user:
  driver    = accept
  condition = ${if eq {${lookup mysql{ \
      SELECT 1 FROM mailbox \
      WHERE username='${quote_mysql:${local_part}@${domain}}' \
        AND active='1'}}}{1}{yes}{no}}
  transport = dovecot_lmtp


cat >/etc/exim4/conf.d/main/02_exim4-custom_ports <<'EOF'
# ручно́й список портов для SMTP listener
daemon_smtp_ports = 25 : 587
EOF


/etc/exim4/conf.d/main/01_exim4-local_interfaces
# на всех IPv4/IPv6
local_interfaces = <; 0.0.0.0 ; ::0



/etc/exim4/conf.d/main/03_exim4-config_tlsoptions
tls_certificate = MAIN_TLS_CERTIFICATE
tls_privatekey  = MAIN_TLS_PRIVATEKEY
tls_certificate = /etc/letsencrypt/live/mail.mcarov.pro/fullchain.pem
tls_privatekey  = /etc/letsencrypt/live/mail.mcarov.pro/privkey.pem

# с другой машины
openssl s_client -starttls smtp -connect mail.mcarov.pro:25 -crlf
tail -f /var/log/exim4/mainlog



# SMTP-AUTH локально (сервер должен сказать 250 OK)
swaks --to test@mcarov.pro \
      --from you@ext.net \
      --server 89.22.228.13 --port 587 --tls \
      --auth LOGIN \
      --auth-user test@mcarov.pro --auth-password 'E74Vveua'


cat >/etc/exim4/conf.d/main/04_exim4-custom_tls <<'EOF'
# --- собственные пути TLS для Exim ---
tls_certificate = /etc/letsencrypt/live/mail.mcarov.pro/fullchain.pem
tls_privatekey  = /etc/letsencrypt/live/mail.mcarov.pro/privkey.pem
EOF


cat >/etc/exim4/conf.d/main/06_exim4-custom_tlsadvertise <<'EOF'
# Рекламируем TLS на любых хостах
tls_advertise_hosts = *
EOF




adduser Debian-exim ssl-cert

for d in /etc/letsencrypt \
         /etc/letsencrypt/live \
         /etc/letsencrypt/archive \
         /etc/letsencrypt/live/mail.mcarov.pro \
         /etc/letsencrypt/archive/mail.mcarov.pro
do
  chgrp ssl-cert "$d"
  chmod 750 "$d"          
done

chgrp ssl-cert /etc/letsencrypt/{live,archive}/mail.mcarov.pro/*pem
chmod 640     /etc/letsencrypt/{live,archive}/mail.mcarov.pro/*pem




exim4 -Mrm $(exim4 -bp | awk '{print $3}')


/etc/exim4/conf.d/auth/30_exim4-config_dovecot
########################################
#  AUTH via Dovecot socket
########################################
dovecot_plain:
  driver        = dovecot
  public_name   = PLAIN
  server_socket = /var/run/dovecot/auth-client
  server_set_id = $auth1

dovecot_login:
  driver        = dovecot
  public_name   = LOGIN
  server_socket = /var/run/dovecot/auth-client
  server_set_id = $auth1


MTA (Mail Transfer Agent) - Агент передачи почты: MTA отвечает за отправку и маршрутизацию почтовых сообщений между различными почтовыми серверами. Он обрабатывает задачи по отправке электронной почты от отправителя к получателю, используя протоколы, такие как SMTP (Simple Mail Transfer Protocol). Примерами MTA являются Exim и Postfix.

MUA (Mail User Agent) - Почтовый клиент: MUA представляет собой программу, используемую конечным пользователем для чтения, отправки и управления своей электронной почтой. Это может быть веб-интерфейс, как в случае RainLoop, или приложение, например, Outlook. MUA взаимодействует с пользователем и передает сообщения MTA для отправки.

MDA (Mail Delivery Agent) - Агент доставки почты: MDA отвечает за доставку почтовых сообщений в почтовый ящик конечного пользователя. Он может выполнять различные задачи, такие как фильтрация спама, сортировка по папкам и сохранение сообщений в почтовом ящике. Dovecot — это пример MDA.



MX (Mail Exchange) — запись MX указывает, какие серверы обрабатывают почту для вашего домена. Это необходимо для корректной маршрутизации почтовых сообщений.

SPF (Sender Policy Framework) — SPF помогает предотвратить поддельные отправители, указывая, какие серверы имеют право отправлять письма от вашего домена.

DKIM (DomainKeys Identified Mail) — DKIM используется для проверки подлинности отправителя посредством электронной подписи. Каждый сервер подписывает и отправляет свое сообщение с использованием ключа DKIM, а затем получатель проверяет подпись.

DMARC (Domain-based Message Authentication, Reporting, and Conformance) — DMARC объединяет SPF и DKIM, а также предоставляет механизм для отчетности о том, как обрабатываются письма, которые не прошли проверку.

PTR (Pointer Record) — PTR-запись используется для создания обратной связи между IP-адресом и доменным именем, что важно для обеспечения доверия в процессе отправки почты.



370_exim4-config_virtual_aliases

virtual_aliases:
  driver = redirect
  allow_fail
  allow_defer
  data = ${lookup mysql{SELECT goto FROM alias WHERE address='${quote_mysql:$local_part@$domain}' AND active='1'}{$value}fail}
  domain = ${lookup mysql{SELECT domain FROM domain WHERE domain='${quote_mysql:$domain}' AND active='1'}{yes}{no}}
  no_expn
  no_verify



/etc/fail2ban/filter.d/rainloop-auth.conf
[Definition]
failregex = ^<HOST> .* "(POST|GET) /?\/?\?\/api\/" .* 401 Unauthorized
ignoreregex =



/etc/fail2ban/filter.d/postfixadmin-auth.conf
[Definition]
failregex = ^<HOST> .* "POST /login.php" .* 302 .* login=failed
ignoreregex =



[rainloop-auth]
enabled   = true
port      = http,https
filter    = rainloop-auth
logpath   = /var/log/nginx/access.log

[postfixadmin-auth]
enabled   = true
port      = http,https
filter    = postfixadmin-auth
logpath   = /var/log/nginx/access.log

[exim-auth]
enabled   = true
port      = 25,465,587
filter    = exim
logpath   = /var/log/exim4/mainlog
maxretry  = 3

[dovecot]
enabled   = true
port      = imap,imap3,imaps,pop3,pop3s
filter    = dovecot
backend = systemd
journalmatch = _SYSTEMD_UNIT=dovecot.service
maxretry  = 5


/etc/letsencrypt/renewal-hooks/post/
#!/bin/bash
for d in /etc/letsencrypt \
         /etc/letsencrypt/live \
         /etc/letsencrypt/archive \
         /etc/letsencrypt/live/mail.mcarov.pro \
         /etc/letsencrypt/archive/mail.mcarov.pro
do
  chgrp ssl-cert "$d"
  chmod 750 "$d"
done

chgrp ssl-cert /etc/letsencrypt/{live,archive}/mail.mcarov.pro/*pem
chmod 640     /etc/letsencrypt/{live,archive}/mail.mcarov.pro/*pem

systemctl reload exim4

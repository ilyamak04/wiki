### Разное

- `haproxy -f /etc/haproxy/haproxy.cfg -c` - тестируем
- `systemctl reload haproxy` - применяем

---

- `errorpage <код_ошибки> <URI>`:
- `errorpage 503 http://example.com/error.html`

---


- `errorfile <код_ошибки> <путь_к_файлу>`:
- `errorfile 503 /etc/haproxy/errors/503.http`

Не требует перенаправления клиента, вся обработка осуществляется на уровне HAProxy

---

- `global` - Настраивает поведение и характеристики самого HAProxy (например, логирование, процессы, ресурсы).
- `defaults` - Задаёт параметры по умолчанию для всех фронтендов и бэкендов, чтобы избежать повторения одинаковых директив.

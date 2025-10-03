### Как создать venv

- Установить пакет `virualvenv`
```bash
apt update
apt install virtualenv
```
- Создать виртуальное окружение, например, для `python3.11`
```bash
virtualenv -p python3.11 venv
```
- Активировать виртульаное окружение
```bash
source venv/bin/activate
```

!!! info "`source` выполняет скрипт в текущей оболочке, а не в дочерней, новый процесс не создаётся"

- Проверить версии
```bash
python --version    
pip --version     
```
- Деактивировать виртуальное окружение
```bash
deactivate
```
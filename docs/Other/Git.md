### Полезные источники

- [**Стетейки по гиту**](https://kb.tishenko.dev/git/aliases/)
- [**GitHowTo**](https://githowto.com/ru)
- [**GitFlow**](https://habr.com/ru/articles/106912/)
- [**Игра**](https://learngitbranching.js.org/?locale=ru_RU)

### Команды 
- `git remote -v` - показывает все удалённые репозитории, которые связаны с локальным репозиторием 
- `git init ; git remote add origin <https> or <ssh>` - добавить удалённый репозиторий 
- `git remote set-url origin git@github.com:ilyamak04/shortest_flight.git` - установить новый url удалённого репозитория
- `rm -rf /path/to/repo/.git` - git больше не будет отслеживать эту директорию 
- `git config --global --list`
- `git config --global user.name "Ваше Имя"`
- `git config --global user.email "ваш_емейл@example.com"`
- `git config ...` - изменить для конкретного репозитория (без флага `--global`)
- `log --pretty=format:'%h %cd | %s%d [%an]' --graph --date=iso` - удобный вывод `git log` 
- `git pull --rebase` - спуллить изменения из удалённого репозитория в локальную ветку не создавая мерджи, локальные коммиты просто встанут после коммитов из удалённого репозитория 

---

- `git init` - создаёт репозиторий в текущей директории
- `git clone` - клонирует удалённый репозиторий
- `git status` - текущее состояние репозиторий 
- `git add <filename>` - добавить в индекс
- `git commit -m` - коммит с сообщением

- `git branch`
```bash
git branch              # список локальных веток
git branch dev          # создать ветку dev
git branch -d dev       # удалить локальную ветку
git branch -D dev       # форсированное удаление
```

- `git log`
```bash
git log                    # список коммитов
git log --oneline          # компактно
git log -p                 # с diff'ами
git log --graph --all      # с ветвлением
```

- `git checkout`
```bash
git checkout dev            # перейти в ветку dev
git checkout -b feature123  # создать и сразу перейти
git checkout -- myfile.txt  # откат файла к HEAD
```

- `современные альтернативы checkout`
```bash
git switch dev # перейти в ветку dev
git switch -c newbranch # создать и сразу перейти

git restore myfile.txt         # откат файла к последнему коммиту
git restore --source=<commit> myfile.txt # откат файла к конкретному коммиту 
git restore --source=HEAD~1 myfile.txt # откат файла к предыдущему коммиту
git restore --staged file.txt  # убрать из индекса
```

- `git merge dev` - объединяет ветку в текущую


- `rebase`
```bash 
# взять все коммиты в ветке feature, которые не входят в main, и "переписать" их поверх последнего коммита в main.
git checkout feature
git rebase main
```

- если во время ребейза возник конфликт 
```bash
# пit остановится и скажет где конфликт
# решаешь конфликт потом:
git add <файл>
git rebase --continue
# если хочешь прервать ребейз
git rebase --abort
```

- применяет отдельный коммит из другой ветки
```bash 
git cherry-pick <hash>
```

- `git show <hash` - показывает содержимое коммита

- `git diff`
```bash
git diff           # рабочая директория vs индекс
git diff --staged   # индекс vs последний коммит
git diff main..dev   # между ветками
```

- откат и исправления
```bash
git reset HEAD~1                # откат на 1 коммит (оставляя файлы, убирает из индекса)
git reset --soft HEAD~1         # откат на 1 коммит (изменения остаются в идексе)
git reset --hard HEAD~1         # откат полностью, удаляет файлы
git reset file.txt              # убрать файл из индекса
```

- создаёт новый коммит, отменяющий изменения указанного коммита
```bash 
git revert <hash>
```

- `git fetch` - получает все изменения с удалённого репозитория, но не сливает их

- `git tag`
```bash 
git tag v1.0                    # создать
git tag -d v1.0                 # удалить
git push origin v1.0            # отправить тэг, по умолчанию git push не отправляет тэги
git push origin --tags          # отправить все теги (origin, имя удалённого репозитория)
```


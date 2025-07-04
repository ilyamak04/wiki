- `sudo alternatives --config java`
- `sudo alternatives --install /usr/bin/java java /usr/lib/jvm/java-17-openjdk/bin/java 3` - добавить java с приоритетом 3
- `sudo alternatives --remove java /usr/lib/jvm/java-17-openjdk/bin/java`

--- 

Версия java
- `jar tf bftDsudDownloader.jar`
- `sudo jar xf bftDsudDownloader.jar io/netty/util/Timer.class`

- `javap -verbose io/netty/util/Timer.class | grep "major version"`


---

[https://stackoverflow.com/questions/2101518/difference-between-xxuseparallelgc-and-xxuseparnewgc]()

( Оригинальный ) копирующий сборщик (включен по умолчанию). Когда этот сборщик включается, все потоки приложения останавливаются, и копирующий сбор продолжается с использованием одного потока (что означает только один ЦП, даже если это многопроцессорная машина). Это известно как сборка stop-the-world, потому что по сути JVM приостанавливает все остальное, пока сборка не будет завершена.

Параллельный копирующий сборщик (включается с помощью -XX:+UseParNewGC). Как и исходный копирующий сборщик, это сборщик stop-the-world. Однако этот сборщик распараллеливает копирующий сбор по нескольким потокам, что более эффективно, чем исходный однопоточный копирующий сборщик для многопроцессорных машин (хотя и не для однопроцессорных машин). Этот алгоритм потенциально ускоряет сборку молодого поколения в разы, равные количеству доступных ЦП, по сравнению с исходным однопоточным копирующим сборщиком.

Параллельный сборщик мусора (включается с помощью -XX:UseParallelGC). Он похож на предыдущий параллельный копирующий сборщик, но алгоритм настроен на гигабайтные кучи (более 10 ГБ) на многопроцессорных машинах. Этот алгоритм сбора предназначен для максимизации пропускной способности при минимизации пауз. Он имеет дополнительную политику адаптивной настройки, которая автоматически изменяет размер пространств кучи. Если вы используете этот сборщик, вы можете использовать только оригинальный сборщик mark-sweep в старом поколении (т. е. более новый конкурентный сборщик старого поколения не может работать с этим молодым сборщиком поколения).

---

  CATALINA_OPTS (Optional) Java runtime options used when the "start",
                   "run" or "debug" command is executed.
                   Include here and not in JAVA_OPTS all options, that should
                   only be used by Tomcat itself, not by the stop process,
                   the version command etc.
                   Examples are heap size, GC logging, JMX ports etc.

  JAVA_OPTS      (Optional) Java runtime options used when any command
                   is executed.
                   Include here and not in CATALINA_OPTS all options, that
                   should be used by Tomcat and also by the stop process,
                   the version command etc.
                   Most options should go into CATALINA_OPTS.


Во-первых, все, что указано в переменной EITHER, передается идентично команде, которая запускает Tomcat - команде startor run- но только значения, заданные в, JAVA_OPTS передаются команде stop. Это, вероятно, не имеет никакого значения для того, как Tomcat работает на практике, поскольку это влияет только на КОНЕЦ выполнения, а не на начало.

Второе отличие более тонкое. Другие приложения также могут использовать JAVA_OPTS, но только Tomcat будет использовать CATALINA_OPTS. Поэтому, если вы устанавливаете переменные среды для использования только Tomcat, вам лучше всего использовать CATALINA_OPTS, тогда как если вы устанавливаете переменные среды для использования другими приложениями Java, такими как JBoss, вам следует поместить свои настройки в JAVA_OPTS.

Я хотел бы добавить, что JAVA_OPTSи CATALINA_OPTS являются взаимодополняющими : если вы определите обе переменные среды, их содержимое будет объединено и передано команде startand run— как объяснил Gnanam выше.

---

https://www.baeldung.com/java-memory-beyond-heap

---

Компиляция и интерпретация в JVM
Компиляция в байт-код:

Когда ты пишешь код на Java и запускаешь компиляцию (например, с помощью javac), исходный код (.java) компилируется в байт-код (.class). Этот байт-код — это промежуточное представление программы, которое не зависит от конкретной операционной системы или архитектуры процессора.

Байт-код — это не машинный код, а набор инструкций для JVM. Он оптимизирован для выполнения на виртуальной машине.

Интерпретация байт-кода:

Когда ты запускаешь программу (например, с помощью java), JVM интерпретирует байт-код. Это значит, что JVM читает инструкции байт-кода и выполняет их шаг за шагом.

Интерпретация происходит "на лету", то есть каждая инструкция байт-кода преобразуется в машинный код и выполняется в момент обращения к ней.

JIT-компиляция (Just-In-Time):

Современные JVM (например, HotSpot в OpenJDK) используют JIT-компиляцию для повышения производительности. Вместо того чтобы интерпретировать байт-код каждый раз, JVM анализирует часто выполняемые участки кода (например, горячие методы) и компилирует их в нативный машинный код.

Этот машинный код сохраняется и используется при последующих вызовах, что значительно ускоряет выполнение программы.

JIT-компиляция сочетает в себе преимущества интерпретации (гибкость, кроссплатформенность) и компиляции (высокая производительность).

Итог:
Компиляция в байт-код происходит один раз, когда ты компилируешь исходный код Java.

Интерпретация байт-кода происходит при запуске программы, если код не был скомпилирован JIT-компилятором.

JIT-компиляция применяется для оптимизации часто выполняемого кода во время работы программы.

Таким образом, JVM использует оба подхода: интерпретацию для гибкости и JIT-компиляцию для производительности. 

### Как снять дамп java процесса

- В контейнере 
```bash
wget -O heap-dump-tool.jar https://repo1.maven.org/maven2/com/paypal/heap-dump-tool/1.3.1/heap-dump-tool-1.3.1-all.jar
docker ps
docker exec mdm_vo_18_8084_node2 ps aux | grep java
java -jar heap-dump-tool.jar capture mdm_vo_18_8084_node2 -p 42
```

- На хосте
```bash
wget -O heap-dump-tool.jar https://repo1.maven.org/maven2/com/paypal/heap-dump-tool/1.3.1/heap-dump-tool-1.3.1-all.jar
java -jar heap-dump-tool.jar capture -p <pid>
```
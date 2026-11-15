# dementia panel

Веб-интерфейс работает с API на том же HTTPS-адресе. Для установки нужны Docker с Compose v2 и настроенный backend. Заполни `backend/.env` по [инструкции backend](../backend/README.md), включая `PUBLIC_URL`.

## Локальный запуск

Начни из каталога panel, где лежат `Dockerfile` и `nginx.conf`. Для локального теста создай сертификат для `localhost` в родительском каталоге, за пределами контекста сборки Docker:

```sh
umask 077
mkdir -p ../.local/tls
openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
  -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost' \
  -keyout ../.local/tls/localhost.key -out ../.local/tls/localhost.crt
```

Выбери способ запуска в зависимости от того, как разложены исходники.

### Backend и panel в одном рабочем каталоге с общим Compose

Перейди в корень проекта, где лежат `compose.yaml`, `backend/` и `panel/`. При первой настройке скопируй корневой `.env.example` в корневой `.env`. Укажи в нём те же `POSTGRES_USER`, `POSTGRES_PASSWORD` и `POSTGRES_DB`, что и в `backend/.env`. Если стек уже установлен, используй его существующий `.env` и имена Docker-томов. Общий Compose сам запустит backend.

```sh
docker compose up -d --build --wait
```

### Backend и panel в отдельных репозиториях

Запусти backend его собственным Compose и выполни из каталога panel:

```sh
docker build -t dementia/frontend:local .
docker run -d --name dementia-frontend --restart unless-stopped \
  --network dementia_panel -p 127.0.0.1:8443:443 \
  -v "$PWD/../.local/tls:/etc/nginx/tls:ro" dementia/frontend:local
```

`dementia_panel` — имя сети при стандартном запуске backend. Если имя проекта Compose переопределено, используй фактическую сеть backend. В этой сети Nginx обращается к API через `backend:8080`.

### Первый вход

Открой `https://localhost:8443`. Если сменил порт панели, используй его и в адресе браузера, и в `PUBLIC_URL`. Для локального теста браузеру нужно доверять созданному сертификату. На чистой базе панель предложит создать администратора. Введи логин и пароль из 12 символов или больше либо сгенерируй пароль в интерфейсе.

## Доступ с VPS и других устройств

Укажи в `backend/.env` адрес, который смогут открыть и браузер, и нода, например `PUBLIC_URL='https://panel.example.com'`. На обратном прокси установи доверенный сертификат для этого имени и направь запросы на HTTPS-порт фронтенда, указав прокси доверенный сертификат фронтенда. Встроенный Nginx сам передаст `/api/`, `/s/`, `/healthz` и `/readyz` в backend. После изменения `PUBLIC_URL` повтори `docker compose up -d` в каталоге, из которого запущен backend.

Проверь внешний адрес через `curl -fsS https://panel.example.com/readyz`. Локальная привязка порта к `127.0.0.1` в примерах рассчитана на запуск с обратным прокси на том же хосте либо на тест в браузере этого хоста.

## Разработка

В каталоге panel установи зависимости через `npm ci` (Node.js 22.12+). Скопируй `.env.example` в `.env` и укажи `BACKEND_URL` с локальным HTTP-адресом API, `BACKEND_PUBLIC_URL` со значением `PUBLIC_URL` backend, а также пути `../.local/tls/localhost.crt` и `../.local/tls/localhost.key` в `DEV_TLS_CERT` и `DEV_TLS_KEY`.

```sh
npm run dev
```

Открой HTTPS-адрес, который выведет Vite. Для сборки статических файлов выполни `npm run build`, результат появится в `dist/`.

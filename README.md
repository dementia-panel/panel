<a href="#english"><kbd>English</kbd></a> <a href="#русский"><kbd>Русский</kbd></a>

# dementia panel

## English

### 1. Start the backend

Complete the backend setup first. Run the remaining commands from the folder containing the same `compose.yaml` and `.env`. [Backend installation](https://github.com/dementia-panel/backend#english)

### 2. Set up HTTPS

Create the TLS directory:

```sh
mkdir -p tls
```

For remote access, place the full certificate chain in `tls/localhost.crt` and the private key in `tls/localhost.key`. The certificate must match the hostname in `PUBLIC_URL` and be trusted by browsers and nodes.

For a local test, generate a self-signed certificate for `localhost` and make it trusted by your browser:

```sh
openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost' -keyout tls/localhost.key -out tls/localhost.crt
```

### 3. Start the panel

```sh
docker compose up -d --pull always --wait frontend
```

### 4. Create the administrator

Open the HTTPS address set in `PUBLIC_URL`. The default is `https://localhost:8443`. On a fresh database, choose a username and set or generate a password in the first-run form.

## Русский

### 1. Запусти backend

Сначала закончи настройку backend. Остальные команды выполни в папке с теми же `compose.yaml` и `.env`. [Установка backend](https://github.com/dementia-panel/backend#русский)

### 2. Настрой HTTPS

Создай каталог для TLS:

```sh
mkdir -p tls
```

Для удалённого доступа помести полную цепочку сертификатов в `tls/localhost.crt`, а приватный ключ — в `tls/localhost.key`. Сертификат должен подходить для имени в `PUBLIC_URL`, и ему должны доверять браузеры и ноды.

Для локального теста сгенерируй самоподписанный сертификат для `localhost` и добавь его в доверенные для браузера:

```sh
openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost' -keyout tls/localhost.key -out tls/localhost.crt
```

### 3. Запусти панель

```sh
docker compose up -d --pull always --wait frontend
```

### 4. Создай администратора

Открой HTTPS-адрес из `PUBLIC_URL`. По умолчанию это `https://localhost:8443`. На чистой базе выбери логин и задай или сгенерируй пароль в форме первого запуска.

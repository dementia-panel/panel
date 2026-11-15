<a href="#english"><kbd>English</kbd></a> <a href="#русский"><kbd>Русский</kbd></a>

# dementia panel

## English

### 1. Start the backend

Complete the backend setup first. Run the remaining commands from the folder containing the same `compose.yaml` and `.env`. [Backend installation](https://github.com/dementia-panel/backend#english)

### 2. Set up HTTPS

Point your domain to the server and allow TCP port 443 in the server firewall. Obtain a certificate from a trusted CA for the hostname in `PUBLIC_URL`. [Get a certificate with Certbot](https://certbot.eff.org/instructions)

```sh
mkdir -p tls
```

Place the full certificate chain in `tls/localhost.crt` and its private key in `tls/localhost.key`. Keep these filenames because the panel image reads them from the mounted TLS directory.

### 3. Start the panel

```sh
sudo docker compose up -d --pull always --wait frontend
```

### 4. Create the administrator

Open the HTTPS address set in `PUBLIC_URL`. On a fresh database, choose a username and set or generate a password in the first-run form.

### 5. Renew HTTPS

After certificate renewal, replace both files and reload Nginx:

```sh
sudo docker compose exec -T frontend nginx -s reload
```

## Русский

### 1. Запусти backend

Сначала закончи настройку backend. Остальные команды выполни в папке с теми же `compose.yaml` и `.env`. [Установка backend](https://github.com/dementia-panel/backend#русский)

### 2. Настрой HTTPS

Направь домен на сервер и разреши входящие подключения на TCP-порт 443. Выпусти сертификат у доверенного центра сертификации для домена из `PUBLIC_URL`. [Получение сертификата через Certbot](https://certbot.eff.org/instructions)

```sh
mkdir -p tls
```

Помести полную цепочку сертификатов в `tls/localhost.crt`, а приватный ключ — в `tls/localhost.key`. Сохрани эти имена, их использует образ панели.

### 3. Запусти панель

```sh
sudo docker compose up -d --pull always --wait frontend
```

### 4. Создай администратора

Открой HTTPS-адрес из `PUBLIC_URL`. На чистой базе выбери логин и задай или сгенерируй пароль в форме первого запуска.

### 5. Продлевай сертификат

После продления сертификата замени оба файла и перечитай конфигурацию Nginx:

```sh
sudo docker compose exec -T frontend nginx -s reload
```

<a href="#english"><kbd>English</kbd></a> <a href="#русский"><kbd>Русский</kbd></a>

# dementia panel

## English

### 1. Start the backend

Complete the backend setup first. Run the remaining commands from the folder containing the same `compose.yaml` and `.env`. [Backend installation](https://github.com/dementia-panel/backend#english)

### 2. Issue and install the HTTPS certificate

Point your domain to the server. Allow inbound TCP traffic on port 80 for Let’s Encrypt validation and port 443 for the panel. Port 80 must be free when Certbot runs. Replace `panel.example.com` in the commands with the hostname from `PUBLIC_URL`. [Certbot standalone mode](https://eff-certbot.readthedocs.io/en/stable/using.html#standalone)

Install Certbot on Ubuntu or Debian and request a certificate. Enter your email and follow Certbot's prompts.

```sh
sudo apt install certbot
```

```sh
sudo certbot certonly --standalone --cert-name panel.example.com -d panel.example.com
```

Copy the certificate chain and private key into the directory mounted by Compose. Keep the destination filenames because the panel image expects them.

```sh
mkdir -p tls
```

```sh
sudo install -m 0644 /etc/letsencrypt/live/panel.example.com/fullchain.pem tls/dementia.crt
```

```sh
sudo install -m 0600 /etc/letsencrypt/live/panel.example.com/privkey.pem tls/dementia.key
```

### 3. Start the panel

```sh
sudo docker compose up -d --pull always --wait frontend
```

### 4. Create the administrator

Open the HTTPS address set in `PUBLIC_URL`. On a fresh database, choose a username and set or generate a password in the first-run form.

### 5. Renew HTTPS

To request renewal when the certificate is due, run:

```sh
sudo certbot renew --cert-name panel.example.com
```

After renewal, repeat the two `install` commands from step 2 and reload Nginx. The panel uses the copies in `tls/`.

```sh
sudo docker compose exec -T frontend nginx -s reload
```

## Русский

### 1. Запусти backend

Сначала закончи настройку backend. Остальные команды выполни в папке с теми же `compose.yaml` и `.env`. [Установка backend](https://github.com/dementia-panel/backend#русский)

### 2. Выпусти и установи HTTPS-сертификат

Направь домен на сервер. Разреши входящие TCP-подключения на порт 80 для проверки Let’s Encrypt и на порт 443 для панели. Порт 80 должен быть свободен во время работы Certbot. Замени `panel.example.com` в командах на домен из `PUBLIC_URL`. [Режим standalone в Certbot](https://eff-certbot.readthedocs.io/en/stable/using.html#standalone)

Установи Certbot на Ubuntu или Debian и запроси сертификат. Введи email и следуй подсказкам Certbot.

```sh
sudo apt install certbot
```

```sh
sudo certbot certonly --standalone --cert-name panel.example.com -d panel.example.com
```

Скопируй цепочку сертификатов и закрытый ключ в каталог, который подключает Compose. Сохрани имена файлов назначения, их использует образ панели.

```sh
mkdir -p tls
```

```sh
sudo install -m 0644 /etc/letsencrypt/live/panel.example.com/fullchain.pem tls/dementia.crt
```

```sh
sudo install -m 0600 /etc/letsencrypt/live/panel.example.com/privkey.pem tls/dementia.key
```

### 3. Запусти панель

```sh
sudo docker compose up -d --pull always --wait frontend
```

### 4. Создай администратора

Открой HTTPS-адрес из `PUBLIC_URL`. На чистой базе выбери логин и задай или сгенерируй пароль в форме первого запуска.

### 5. Продлевай сертификат

Когда подходит срок продления, выполни:

```sh
sudo certbot renew --cert-name panel.example.com
```

После продления повтори обе команды `install` из шага 2 и перечитай конфигурацию Nginx. Панель использует копии файлов из каталога `tls/`.

```sh
sudo docker compose exec -T frontend nginx -s reload
```

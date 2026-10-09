# Crypto Tracker

Backend-сервис для отслеживания торговых пар криптовалют и хранения истории цен из CoinMarketCap API.

## Стек

- Node.js 24+
- Express.js
- TypeScript
- SQLite через встроенный модуль `node:sqlite`, без ORM
- axios
- Jest и Supertest

Node.js 24+ требуется для работы с `node:sqlite` без стороннего SQLite-драйвера.

## Установка и запуск

```bash
npm install
npm run build
npm start
```

По умолчанию сервер запускается на `http://localhost:3000`. Проверка запуска: `GET /health`.

Для разработки:

```bash
npm run dev
```

## Настройка

Файл `.env.example` содержит образец переменных окружения. На его основе внутри проекта создайте файл `.env` и заполните переменные окружения:

```dotenv
PORT=3000
DATABASE_PATH=./data/prices.sqlite
API_KEY=your-service-api-key
CMC_API_KEY=your-coinmarketcap-api-key
CMC_TIMEOUT_MS=5000
SYNC_INTERVAL_MS=60000
```

`API_KEY` защищает маршруты этого сервиса. `CMC_API_KEY` используется сервером для запросов к CoinMarketCap.

При запуске Node.js загружает значения из локального файла .env. Переменные, уже заданные в окружении системы, имеют приоритет над значениями файла.

Файл базы данных создаётся локально и не добавляется в репозиторий.

## API

Предварительный список маршрутов и правила ответов описаны в [контракте API](docs/api-contract.md). По мере реализации он будет дополнен.

## Запуск через Docker Compose

Создайте локальный `.env` на основе `.env.example` и заполните `API_KEY` и `CMC_API_KEY`.
Затем запустите:

```bash
docker compose up --build -d
```

API будет доступен по адресу `http://localhost:3000`.
Данные SQLite хранятся в именованном томе `prices_data`.

Остановить сервис:

```bash
docker compose down
```

# График смен

Редактор графика сотрудников по макету Figma. React и TypeScript на клиенте,
Node.js и Hono для REST API, PostgreSQL для опубликованного графика.

## Локальный запуск

Нужен Node.js 22. Версия для nvm указана в `.nvmrc`.

```sh
npm ci
npm run dev
```

Откройте [редактор(указан prod)](https://axelkroos-tz-russmarket-8e3b.twc1.net/) или
[опубликованный график(указан prod)](https://axelkroos-tz-russmarket-8e3b.twc1.net/?view=published). Без
`DATABASE_URL` сервер использует PGlite с PostgreSQL и сохраняет данные
в `.data/schedule`. При первом запуске добавляются сотрудники из макета.

Для подключения отдельного PostgreSQL запустите базу через Docker Compose
и передайте строку подключения к локальной базе.

```sh
docker compose up -d --wait postgres
DATABASE_URL=postgres://schedule:schedule@127.0.0.1:5433/schedule DEMO_DATA=1 npm run dev
```

## Сборка и проверки

```sh
npm run format:check
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Для браузерных проверок нужен установленный Chrome. Тесты используют отдельную
базу во временном каталоге. Готовую сборку можно запустить через `npm start`
на [порту 3001](http://127.0.0.1:3001).

Клиент лежит в `app/`, обработчики API в `server/`, общие типы и правила
валидации в `shared/`, схема и демонстрационные данные в `db/`.
Поведение и правила проекта описаны в [документации](docs/project.md).

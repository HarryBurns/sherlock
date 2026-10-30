# Sherlock

Браузерная логическая головоломка в жанре «загадки Эйнштейна» с эмодзи. Работает без сервера, прогресс хранится в браузере.

Играть: https://harryburns.github.io/sherlock/

Правила: [docs/RULES.md](docs/RULES.md)

## Разработка

```bash
npm install
npm start      # dev-сервер на http://localhost:4200
npm test       # тесты (vitest)
npm run build  # сборка в dist/
```

Деплой на GitHub Pages идёт автоматически при пуше в `main` (`.github/workflows/deploy.yml`).

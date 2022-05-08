# Development

Установка зависимостей

```
npm install
```

Запуск локального дев-сервера с файл-вотчером (если что-то идёт не так - запускаем `npm install` и пробуем ещё раз)

```
npm start
```

Запуск форматтера и линтера с автоматическим исправлением исправимого, а что автоматом не исправится - пожалуется.

```
npm run fix
```

Форматирование проекта (входит в `fix`)

```
npm run format:fix
```

Проверка линтером

```
npm run lint
```

Проверка линтером с исправлением

```
npm run lint:fix
```

## Плагины на vs code
Для [prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) и
    [eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
  есть плагины, если студия и линтер будут требовать разного, то пофиксить можно ими.

## Открытие нужной сцены, минуя меню
Добавьте в URL параметр `openScene=<ключ сцены>`: `localhost:1234/?openScene=StartingScene`

# Build

```
npm run build
```

# Образ приложения MiniCal: гость на «/», владелец на «/admin», API на том же origin.
# Этап build собирает два web-бандла клиента, рантайм-этап несёт только цепочку API.
#
# Major-версия Node продублирована из `.nvmrc` (там `26`) и правится вместе с ним: платформа
# деплоя собирает образ без make, поэтому дефолт обязан стоять прямо в Dockerfile, а не только
# приезжать `--build-arg`. ARG до первого FROM виден обоим этапам — major записан здесь один
# раз и разъехаться между этапами не может.
ARG NODE_VERSION=26

FROM node:${NODE_VERSION}-slim AS build

# Expo CLI без TTY: не задавать вопросов и не слать телеметрию.
ENV CI=1
WORKDIR /app

# Манифесты всех workspaces отдельным слоем: правка исходников не переустанавливает зависимости.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/client/package.json apps/client/
COPY packages/api-client/package.json packages/api-client/
COPY packages/backend-contract/package.json packages/backend-contract/
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
RUN npm ci

COPY . .

WORKDIR /app/apps/client

# Два экспорта из одного кода: режим и адрес API вшиваются в бандл на этапе сборки. `--clear`
# обязателен обоим — значения EXPO_PUBLIC_* не входят в ключ transform-кеша Metro, и без сброса
# второй экспорт молча переиспользовал бы модули первого (владельческий бандл вышел бы гостевым).
RUN EXPO_PUBLIC_APP_MODE=guest \
    EXPO_PUBLIC_API_BASE_URL=same-origin \
    /app/node_modules/.bin/expo export --platform web --output-dir dist/guest --clear

# Владельческий бандл раздаётся не с корня сайта, а экспорт адресует ассеты абсолютно
# (`/_expo/static/...`): без базового префикса он просил бы их из гостевого бандла.
RUN EXPO_PUBLIC_APP_MODE=owner \
    EXPO_PUBLIC_API_BASE_URL=same-origin \
    EXPO_WEB_BASE_URL=/admin \
    /app/node_modules/.bin/expo export --platform web --output-dir dist/owner --clear


FROM node:${NODE_VERSION}-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Только манифесты цепочки API: полный набор манифестов workspaces протаскивает в дерево
# dev-зависимости вопреки `--omit=dev` — особенность npm, а не ошибка состава.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/backend-contract/package.json packages/backend-contract/
# Манифест @minical/database входит в ту же цепочку: пакет — рантайм-зависимость apps/api, и без
# его манифеста workspace-фильтр не находит цель симлинка и обрывает установку.
COPY packages/database/package.json packages/database/

# Workspace-фильтр оставляет express, zod, pg и симлинки @minical/backend-contract и
# @minical/database. Симлинки обязательны: внутри физического node_modules Node отказывается
# стриптить типы (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING).
RUN npm ci --omit=dev -w apps/api

# Сборки у API нет — в образ едут исходники, как и при локальном запуске.
COPY apps/api/src apps/api/src
COPY packages/backend-contract/src packages/backend-contract/src
COPY packages/database/src packages/database/src

# SQL-миграции — не исходники, а данные раннера: он читает каталог на старте, поэтому тот едет
# в образ рядом с кодом пакета.
COPY packages/database/migrations packages/database/migrations

# Каталоги конвенции, по которым server.ts находит бандлы и включает их раздачу.
COPY --from=build /app/apps/client/dist/guest apps/client/dist/guest
COPY --from=build /app/apps/client/dist/owner apps/client/dist/owner

USER node
CMD ["node", "apps/api/src/server.ts"]

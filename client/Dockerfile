# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.19.0

FROM node:${NODE_VERSION}-alpine as base

WORKDIR /usr/src/app


FROM base as deps

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=yarn.lock,target=yarn.lock \
    --mount=type=cache,target=/root/.yarn \
    yarn install --frozen-lockfile

RUN chmod 777 /usr/src/app/node_modules -R

FROM deps as build

COPY . .
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=yarn.lock,target=yarn.lock \
    --mount=type=cache,target=/root/.yarn \
    yarn run build

FROM base as final

ENV NODE_ENV production

USER root

COPY package.json .

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
RUN chmod 777 ./node_modules -R


EXPOSE 5173

CMD yarn dev --host

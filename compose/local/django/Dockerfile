# Python dependencies are managed by Pixi (see pixi.toml / pixi.lock).
FROM ghcr.io/prefix-dev/pixi:latest

ARG APP_HOME=/app
# The Pixi project lives outside $APP_HOME because docker compose mounts the source over it.
ARG PIXI_HOME_DIR=/opt/pixi-project
WORKDIR ${PIXI_HOME_DIR}

COPY pixi.toml pixi.lock ./
RUN pixi install --locked -e default

ENV PATH="${PIXI_HOME_DIR}/.pixi/envs/default/bin:$PATH"

RUN apt-get update && apt-get install --no-install-recommends -y \
  gettext \
  wait-for-it \
  && rm -rf /var/lib/apt/lists/*

WORKDIR ${APP_HOME}
COPY . ${APP_HOME}

COPY ./compose/production/django/entrypoint /entrypoint
RUN sed -i 's/\r$//g' /entrypoint
RUN chmod +x /entrypoint

COPY ./compose/local/django/start /start
RUN sed -i 's/\r$//g' /start
RUN chmod +x /start

ENTRYPOINT ["/entrypoint"]

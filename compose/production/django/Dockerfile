# Python dependencies are managed by Pixi (see pixi.toml / pixi.lock).
FROM ghcr.io/prefix-dev/pixi:latest AS python-build-stage
ARG APP_HOME=/app
WORKDIR ${APP_HOME}

# Environment is installed first so it is cached until the lock file changes.
COPY pixi.toml pixi.lock ./
RUN pixi install --locked -e production

COPY . ${APP_HOME}

# Python 'run' stage
FROM debian:bookworm-slim AS python-run-stage
ARG APP_HOME=/app
WORKDIR ${APP_HOME}

RUN addgroup --system django \
  && adduser --system --ingroup django --home /home/django django

# Install required system dependencies
RUN apt-get update && apt-get install --no-install-recommends -y \
  # Translations dependencies
  gettext \
  # entrypoint
  wait-for-it \
  # cleaning up unused files
  && apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
  && rm -rf /var/lib/apt/lists/*

COPY --chown=django:django ./compose/production/django/entrypoint /entrypoint
RUN sed -i 's/\r$//g' /entrypoint
RUN chmod +x /entrypoint

COPY --chown=django:django ./compose/production/django/start /start
RUN sed -i 's/\r$//g' /start
RUN chmod +x /start

# Copy the application and its Pixi environment from the builder
COPY --from=python-build-stage --chown=django:django ${APP_HOME} ${APP_HOME}

# explicitly create the media folder and make django its owner (nginx serves it, django writes uploads)
RUN mkdir -p ${APP_HOME}/health_huddle/media \
  && chown django:django ${APP_HOME}/health_huddle/media

# make django owner of the WORKDIR directory as well.
RUN chown django:django ${APP_HOME}

# Place executables of the Pixi environment at the front of the path
ENV PATH="/app/.pixi/envs/production/bin:$PATH"

USER django

RUN DATABASE_URL="postgres://dummy" \
  DJANGO_SETTINGS_MODULE="config.settings.test" \
  python manage.py compilemessages

ENTRYPOINT ["/entrypoint"]

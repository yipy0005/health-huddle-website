# Python dependencies are managed by Pixi (see pixi.toml / pixi.lock).
FROM ghcr.io/prefix-dev/pixi:latest

ARG APP_HOME=/app
WORKDIR ${APP_HOME}

COPY pixi.toml pixi.lock ./
RUN pixi install --locked -e default

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install --no-install-recommends -y \
  # To run the Makefile
  make \
  # Translations dependencies
  gettext \
  # Uncomment below lines to enable Sphinx output to latex and pdf
  # texlive-latex-recommended \
  # texlive-fonts-recommended \
  # texlive-latex-extra \
  # latexmk \
  # cleaning up unused files
  && apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
  && rm -rf /var/lib/apt/lists/*

COPY . ${APP_HOME}

COPY ./compose/local/docs/start /start-docs
RUN sed -i 's/\r$//g' /start-docs
RUN chmod +x /start-docs

ENV PATH="/app/.pixi/envs/default/bin:$PATH"

WORKDIR /docs

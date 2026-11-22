# Health Huddle · Faringdon pilot

Django project generated from [cookiecutter-django](https://github.com/cookiecutter/cookiecutter-django) (PostgreSQL, Docker, WhiteNoise, Mailpit, email-based users). The existing browser application is served unchanged from `health_huddle/static/app/` through the `home` view (`health_huddle/templates/pages/app.html`). It still keeps its data in the browser; no pilot data is stored on the server yet.

All Python dependencies and commands are managed by [Pixi](https://pixi.sh). Do not use `pip` or `uv` directly.

## Local development with Pixi

```sh
pixi install            # create the environment from pixi.lock
pixi run db-create      # init and start a local PostgreSQL in .pgdata, create the database
pixi run migrate
pixi run runserver      # http://localhost:8000
pixi run test           # pytest
pixi run db-stop        # stop the local PostgreSQL
```

Other tasks: `manage <args>`, `makemigrations`, `shell`, `createsuperuser`, `lint`, `typecheck` (see `pixi.toml`). Add a dependency with `pixi add --pypi <package>` (or `pixi add --feature dev --pypi <package>` for development-only packages).

## Docker

`docker compose -f docker-compose.local.yml up --build` (or `just up`) runs Django, PostgreSQL and Mailpit. The images install the Pixi environment from `pixi.lock` (`default` for local, `production` for `docker-compose.production.yml`). Docker was not available when this migration was made, so the images are untested. See `docs/` for the cookiecutter-django guides.

## Layout

| Path | Contents |
| --- | --- |
| `pixi.toml`, `pixi.lock` | Python dependencies, environments and tasks |
| `config/` | Django settings (`base`, `local`, `production`, `test`) and URLs |
| `health_huddle/static/app/` | Existing JavaScript app: `app.mjs`, `model.mjs`, `map.mjs`, `media.mjs`, `seed-data.mjs`, CSS, `assets/` |
| `health_huddle/templates/pages/app.html` | Page shell for the JavaScript app |
| `health_huddle/users/` | Email-based user model and allauth setup |
| `compose/`, `docker-compose.*.yml` | Docker configuration |
| `legacy-node/` | Previous Node server, Dockerfile and README, kept for reference |

## Pilot data and external services

The pilot uses a fixed test date of 11 October 2026 and sample timetables. Role selection simulates access. The browser stores edits and recordings locally per site address and browser profile. Use test data only. Google Fonts and the embedded Google Maps view use external services. Speech recognition depends on browser support.

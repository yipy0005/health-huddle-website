# Health Huddle · Faringdon pilot

An editable, standalone copy of the browser application served by the [Faringdon pilot](https://health-huddle-faringdon-pilot.plumzebra16.chatgpt.site/). This Git history begins with the published client files and the VM packaging. The site includes the group directory, map, calendar, Champion workflows, attendance, notes, invitations and report downloads.

## Run on a Linux VM

Extract the archive and open a shell in the health-huddle directory. With Docker Engine and the Compose plugin installed, run:

```sh
docker compose up --build -d
curl -I http://127.0.0.1:8080/
```

The service listens on the VM's loopback address by default. To view it privately from your laptop, run the following on your laptop, replacing the SSH destination:

```sh
ssh -N -L 8080:127.0.0.1:8080 user@your-vm
```

Open http://localhost:8080 in your laptop browser. To serve a domain, point your HTTPS reverse proxy at 127.0.0.1:8080. To expose the demo directly on the VM network instead, run `BIND_ADDRESS=0.0.0.0 docker compose up -d` and visit http://VM-IP:8080 if your firewall permits it. Use HTTPS for microphone access on a remote domain.

Run `docker compose logs web` to see startup output and `docker compose down` to stop the service. After editing the site, run `docker compose up --build -d` to publish the edits.

## Run without Docker

With Node.js 22 installed, run `node server.mjs` and visit http://localhost:8080. There are no npm dependencies. Restart the process after changing files. Alternatively, serve the contents of `site/` with a static web server configured to serve .mjs as JavaScript.

## Source layout

| Path | Contents |
| --- | --- |
| site/index.html, site/app.mjs | Entry page, navigation, forms, role previews and downloads |
| site/model.mjs, site/seed-data.mjs | Group fixtures, recurrence, attendance, requests and reports |
| site/map.mjs, site/media.mjs | Location discovery, voice notes and media storage |
| site/styles.css, site/map.css, site/assets/ | Presentation, logo and sample leaflet |
| server.mjs, Dockerfile, compose.yaml | VM server and container configuration |

## Pilot data and external services

The pilot uses a fixed test date of 11 October 2026 and sample timetables. Role selection simulates access. The browser stores edits and recordings locally for each site address and browser profile. Moving to a new address starts a fresh demo. Hosting this repository does not create shared accounts, server-side records or email delivery. Use test data only.

All pilot files are bundled. Google Fonts and the embedded Google Maps view use external services. Speech recognition depends on browser support.

## Version control

The archive includes the .git directory and a main branch. Run `git log -1` to inspect the starting commit. To push to your own empty Git repository, add its URL with `git remote add origin YOUR_REPOSITORY_URL` and run `git push -u origin main`.

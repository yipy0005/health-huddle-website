from http import HTTPStatus

import pytest
from django.contrib.staticfiles import finders
from django.urls import reverse


@pytest.mark.django_db
def test_home_serves_app_shell(client):
    response = client.get(reverse("home"))
    assert response.status_code == HTTPStatus.OK
    assert b'<div id="app">' in response.content
    assert b"app/app.mjs" in response.content


def test_app_static_files_found():
    for name in ("app/app.mjs", "app/styles.css", "app/assets/logo.jpg"):
        assert finders.find(name)

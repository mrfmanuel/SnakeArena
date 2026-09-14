def test_create_new_profile_returns_201_with_default_stats(client):
    resp = client.post("/api/profiles", json={"name": "Alice"})

    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Alice"
    assert body["stats"] == {"wins": 0, "draws": 0, "losses": 0, "bestLength": 0}
    assert "id" in body and "createdAt" in body


def test_posting_an_existing_name_reuses_the_same_profile(client):
    first = client.post("/api/profiles", json={"name": "Alice"})
    second = client.post("/api/profiles", json={"name": "Alice"})

    assert first.status_code == 201
    assert second.status_code == 200  # reused, not created
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["createdAt"] == first.json()["createdAt"]


def test_profile_names_are_case_sensitive(client):
    lower = client.post("/api/profiles", json={"name": "alice"})
    upper = client.post("/api/profiles", json={"name": "Alice"})

    assert lower.status_code == 201
    assert upper.status_code == 201  # distinct profile, not a reuse
    assert lower.json()["id"] != upper.json()["id"]


def test_create_profile_rejects_empty_name(client):
    resp = client.post("/api/profiles", json={"name": ""})
    assert resp.status_code == 400
    assert "message" in resp.json()


def test_create_profile_rejects_name_over_max_length(client):
    resp = client.post("/api/profiles", json={"name": "x" * 25})
    assert resp.status_code == 400


def test_get_profile_returns_404_when_missing(client):
    resp = client.get("/api/profiles/Nobody")
    assert resp.status_code == 404
    assert "message" in resp.json()


def test_get_profile_returns_current_stats(client):
    client.post("/api/profiles", json={"name": "Alice"})

    resp = client.get("/api/profiles/Alice")

    assert resp.status_code == 200
    assert resp.json()["name"] == "Alice"


def test_get_profile_history_returns_404_when_missing(client):
    resp = client.get("/api/profiles/Nobody/history")
    assert resp.status_code == 404


def test_get_profile_history_is_empty_for_new_profile(client):
    client.post("/api/profiles", json={"name": "Alice"})

    resp = client.get("/api/profiles/Alice/history")

    assert resp.status_code == 200
    assert resp.json() == []

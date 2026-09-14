def test_submit_single_player_score(client):
    resp = client.post("/api/scores", json={"profileName": "Alice", "length": 7})

    assert resp.status_code == 201
    body = resp.json()
    assert body["profileName"] == "Alice"
    assert body["length"] == 7
    assert "id" in body and "date" in body


def test_submitting_a_score_auto_creates_a_missing_profile(client):
    client.post("/api/scores", json={"profileName": "Newbie", "length": 5})

    resp = client.get("/api/profiles/Newbie")

    assert resp.status_code == 200
    assert resp.json()["stats"]["bestLength"] == 5


def test_best_length_only_increases(client):
    client.post("/api/scores", json={"profileName": "Alice", "length": 5})
    client.post("/api/scores", json={"profileName": "Alice", "length": 3})

    resp = client.get("/api/profiles/Alice")

    assert resp.json()["stats"]["bestLength"] == 5


def test_submit_score_rejects_negative_length(client):
    resp = client.post("/api/scores", json={"profileName": "Alice", "length": -1})
    assert resp.status_code == 400


def test_submit_score_rejects_missing_profile_name(client):
    resp = client.post("/api/scores", json={"length": 5})
    assert resp.status_code == 400

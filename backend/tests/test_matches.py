def test_submit_match_win_updates_both_profiles(client):
    resp = client.post(
        "/api/matches",
        json={
            "players": [{"name": "Alice", "length": 10}, {"name": "Bob", "length": 4}],
            "outcome": "win",
            "winnerName": "Alice",
        },
    )

    assert resp.status_code == 201
    body = resp.json()
    assert body["outcome"] == "win"
    assert body["winnerName"] == "Alice"

    winner = client.get("/api/profiles/Alice").json()
    loser = client.get("/api/profiles/Bob").json()
    assert winner["stats"] == {"wins": 1, "draws": 0, "losses": 0, "bestLength": 10}
    assert loser["stats"] == {"wins": 0, "draws": 0, "losses": 1, "bestLength": 4}


def test_submit_match_draw_updates_both_profiles(client):
    resp = client.post(
        "/api/matches",
        json={
            "players": [{"name": "Alice", "length": 6}, {"name": "Bob", "length": 6}],
            "outcome": "draw",
        },
    )

    assert resp.status_code == 201
    assert resp.json()["winnerName"] is None

    alice = client.get("/api/profiles/Alice").json()
    bob = client.get("/api/profiles/Bob").json()
    assert alice["stats"]["draws"] == 1
    assert bob["stats"]["draws"] == 1


def test_submit_match_rejects_duplicate_player_names(client):
    resp = client.post(
        "/api/matches",
        json={
            "players": [{"name": "Alice", "length": 5}, {"name": "Alice", "length": 5}],
            "outcome": "draw",
        },
    )
    assert resp.status_code == 400


def test_submit_match_rejects_winner_not_among_players(client):
    resp = client.post(
        "/api/matches",
        json={
            "players": [{"name": "Alice", "length": 5}, {"name": "Bob", "length": 3}],
            "outcome": "win",
            "winnerName": "Charlie",
        },
    )
    assert resp.status_code == 400


def test_submit_match_rejects_winner_name_present_on_draw(client):
    resp = client.post(
        "/api/matches",
        json={
            "players": [{"name": "Alice", "length": 5}, {"name": "Bob", "length": 5}],
            "outcome": "draw",
            "winnerName": "Alice",
        },
    )
    assert resp.status_code == 400


def test_submit_match_rejects_missing_winner_name_on_win(client):
    resp = client.post(
        "/api/matches",
        json={
            "players": [{"name": "Alice", "length": 5}, {"name": "Bob", "length": 3}],
            "outcome": "win",
        },
    )
    assert resp.status_code == 400


def test_submit_match_rejects_wrong_number_of_players(client):
    resp = client.post(
        "/api/matches",
        json={
            "players": [{"name": "Alice", "length": 5}],
            "outcome": "draw",
        },
    )
    assert resp.status_code == 400


def test_match_history_reflects_win_and_loss(client):
    client.post(
        "/api/matches",
        json={
            "players": [{"name": "Alice", "length": 10}, {"name": "Bob", "length": 4}],
            "outcome": "win",
            "winnerName": "Alice",
        },
    )

    alice_history = client.get("/api/profiles/Alice/history").json()
    bob_history = client.get("/api/profiles/Bob/history").json()

    assert len(alice_history) == 1
    assert alice_history[0]["opponent"] == "Bob"
    assert alice_history[0]["result"] == "win"
    assert alice_history[0]["length"] == 10

    assert bob_history[0]["opponent"] == "Alice"
    assert bob_history[0]["result"] == "loss"
    assert bob_history[0]["length"] == 4


def test_match_history_reflects_draw(client):
    client.post(
        "/api/matches",
        json={
            "players": [{"name": "Alice", "length": 6}, {"name": "Bob", "length": 6}],
            "outcome": "draw",
        },
    )

    assert client.get("/api/profiles/Alice/history").json()[0]["result"] == "draw"
    assert client.get("/api/profiles/Bob/history").json()[0]["result"] == "draw"

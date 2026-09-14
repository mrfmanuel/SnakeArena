def test_leaderboard_is_empty_with_no_activity(client):
    resp = client.get("/api/leaderboard")
    assert resp.status_code == 200
    assert resp.json() == []


def test_leaderboard_ranks_by_length_descending(client):
    client.post("/api/scores", json={"profileName": "Alice", "length": 5})
    client.post("/api/scores", json={"profileName": "Bob", "length": 12})
    client.post(
        "/api/matches",
        json={
            "players": [{"name": "Carol", "length": 8}, {"name": "Dave", "length": 20}],
            "outcome": "win",
            "winnerName": "Dave",
        },
    )

    resp = client.get("/api/leaderboard")

    assert resp.status_code == 200
    rows = resp.json()
    lengths = [row["length"] for row in rows]
    assert lengths == sorted(lengths, reverse=True)
    assert rows[0]["profileName"] == "Dave"
    assert rows[0]["length"] == 20


def test_leaderboard_includes_both_single_and_match_rows(client):
    client.post("/api/scores", json={"profileName": "Alice", "length": 5})
    client.post(
        "/api/matches",
        json={
            "players": [{"name": "Bob", "length": 3}, {"name": "Carol", "length": 3}],
            "outcome": "draw",
        },
    )

    rows = client.get("/api/leaderboard").json()

    types = {row["type"] for row in rows}
    assert types == {"single", "match"}

    single_row = next(row for row in rows if row["type"] == "single")
    assert single_row["detail"] == "Single-player"

    draw_rows = [row for row in rows if row["type"] == "match"]
    assert all(row["detail"] == "Draw" for row in draw_rows)


def test_leaderboard_exact_order_for_mixed_lengths(client):
    client.post("/api/scores", json={"profileName": "A", "length": 3})
    client.post("/api/scores", json={"profileName": "B", "length": 15})
    client.post("/api/scores", json={"profileName": "C", "length": 7})
    client.post(
        "/api/matches",
        json={"players": [{"name": "D", "length": 1}, {"name": "E", "length": 20}], "outcome": "win", "winnerName": "E"},
    )

    rows = client.get("/api/leaderboard").json()

    assert [row["profileName"] for row in rows] == ["E", "B", "C", "A", "D"]
    assert [row["length"] for row in rows] == [20, 15, 7, 3, 1]


def test_leaderboard_keeps_both_entries_on_a_length_tie(client):
    client.post("/api/scores", json={"profileName": "A", "length": 10})
    client.post("/api/scores", json={"profileName": "B", "length": 10})

    rows = client.get("/api/leaderboard").json()

    assert len(rows) == 2
    assert {row["profileName"] for row in rows} == {"A", "B"}
    assert all(row["length"] == 10 for row in rows)

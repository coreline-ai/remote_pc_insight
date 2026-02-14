from app.api.v1.routers.devices import _build_trend_signals


def test_build_trend_signals_includes_ping_latency_degradation():
    reports = [
        {"disk_free_percent": 12.0, "startup_apps_count": 52},
        {"disk_free_percent": 28.0, "startup_apps_count": 34},
        {"disk_free_percent": 24.0, "startup_apps_count": 32},
    ]
    response = _build_trend_signals(
        "dev_test",
        reports,
        ping_latencies=[920.0, 410.0, 430.0],
    )

    metrics = {signal.metric: signal for signal in response.signals}
    assert "ping_latency_ms" in metrics
    assert metrics["ping_latency_ms"].status == "degraded"
    assert any(signal.status == "degraded" for signal in response.signals)
    assert "악화 신호" in response.summary


def test_build_trend_signals_supports_ping_only_data():
    response = _build_trend_signals(
        "dev_test",
        [],
        ping_latencies=[250.0, 260.0, 240.0],
    )

    assert len(response.signals) == 1
    assert response.signals[0].metric == "ping_latency_ms"
    assert response.signals[0].status == "stable"

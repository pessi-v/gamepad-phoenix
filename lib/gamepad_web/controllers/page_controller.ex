defmodule GamepadWeb.PageController do
  use GamepadWeb, :controller

  def home(conn, _params) do
    session_id              = :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
    gamepad_rtc_session_id = :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
    gamepad_api_session_id = :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
    nes_session_id         = :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
    pad_url                = url(~p"/pad/#{session_id}")
    sensor_url             = url(~p"/sensor/#{session_id}")
    sensor_graph_url       = url(~p"/sensor-graph/#{session_id}")
    gamepad_rtc_url        = url(~p"/pad/#{gamepad_rtc_session_id}")
    gamepad_api_url        = url(~p"/pad/#{gamepad_api_session_id}")
    nes_url                = url(~p"/pad/#{nes_session_id}")
    render(conn, :home,
      session_id: session_id,
      pad_url: pad_url,
      sensor_url: sensor_url,
      sensor_graph_url: sensor_graph_url,
      gamepad_rtc_url: gamepad_rtc_url,
      gamepad_rtc_session_id: gamepad_rtc_session_id,
      gamepad_api_url: gamepad_api_url,
      gamepad_api_session_id: gamepad_api_session_id,
      nes_url: nes_url,
      nes_session_id: nes_session_id
    )
  end
end

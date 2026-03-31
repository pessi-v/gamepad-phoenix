defmodule GamepadWeb.PageController do
  use GamepadWeb, :controller

  def home(conn, _params) do
    session_id              = :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
    gamepad_rtc_session_id = :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
    nes_session_id         = :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
    pingpong_session_id    = :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
    pad_url                = url(~p"/pad/#{session_id}")
    sensor_url             = url(~p"/sensor/#{session_id}")
    fish_demo_url          = url(~p"/fish-demo/#{session_id}")
    gamepad_rtc_url        = url(~p"/pad/#{gamepad_rtc_session_id}")
    nes_url                = url(~p"/pad/#{nes_session_id}")
    pingpong_url           = url(~p"/pingpong/#{pingpong_session_id}")
    render(conn, :home,
      session_id: session_id,
      pad_url: pad_url,
      sensor_url: sensor_url,
      fish_demo_url: fish_demo_url,
      gamepad_rtc_url: gamepad_rtc_url,
      gamepad_rtc_session_id: gamepad_rtc_session_id,
      nes_url: nes_url,
      nes_session_id: nes_session_id,
      pingpong_url: pingpong_url,
      pingpong_session_id: pingpong_session_id
    )
  end
end

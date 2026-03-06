defmodule GamepadWeb.PageController do
  use GamepadWeb, :controller

  def home(conn, _params) do
    session_id = :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
    pad_url    = url(~p"/pad/#{session_id}")
    sensor_url = url(~p"/sensor/#{session_id}")
    draw_url   = url(~p"/draw/#{session_id}")
    render(conn, :home, session_id: session_id, pad_url: pad_url, sensor_url: sensor_url, draw_url: draw_url)
  end
end

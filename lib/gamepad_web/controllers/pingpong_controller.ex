defmodule GamepadWeb.PingpongController do
  use GamepadWeb, :controller

  def pingpong(conn, %{"session_id" => session_id}) do
    render(conn, :pingpong, session_id: session_id)
  end
end

defmodule GamepadWeb.DrawController do
  use GamepadWeb, :controller

  def draw(conn, %{"session_id" => session_id}) do
    render(conn, :draw, session_id: session_id)
  end

  def draw_preview(conn, _params) do
    render(conn, :draw, session_id: "preview")
  end
end

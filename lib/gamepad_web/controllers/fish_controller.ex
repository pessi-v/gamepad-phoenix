defmodule GamepadWeb.FishController do
  use GamepadWeb, :controller

  def fish(conn, %{"session_id" => session_id}) do
    render(conn, :fish, session_id: session_id)
  end

  def fish_preview(conn, _params) do
    render(conn, :fish, session_id: "preview")
  end
end

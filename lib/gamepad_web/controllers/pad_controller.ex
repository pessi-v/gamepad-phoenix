defmodule GamepadWeb.PadController do
  use GamepadWeb, :controller

  def pad(conn, %{"session_id" => session_id}) do
    render(conn, :pad, session_id: session_id)
  end
end

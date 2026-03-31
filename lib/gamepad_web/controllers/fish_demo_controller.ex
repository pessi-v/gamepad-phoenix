defmodule GamepadWeb.FishDemoController do
  use GamepadWeb, :controller

  def fish_demo(conn, %{"session_id" => session_id}) do
    render(conn, :fish_demo, session_id: session_id)
  end

  def fish_demo_preview(conn, _params) do
    render(conn, :fish_demo, session_id: "preview")
  end
end

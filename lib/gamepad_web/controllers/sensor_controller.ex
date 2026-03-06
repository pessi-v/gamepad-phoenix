defmodule GamepadWeb.SensorController do
  use GamepadWeb, :controller

  def sensor(conn, %{"session_id" => session_id}) do
    render(conn, :sensor, session_id: session_id)
  end

  def sensor_preview(conn, _params) do
    render(conn, :sensor, session_id: "preview")
  end
end

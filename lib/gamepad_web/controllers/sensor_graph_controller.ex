defmodule GamepadWeb.SensorGraphController do
  use GamepadWeb, :controller

  def sensor_graph(conn, %{"session_id" => session_id}) do
    render(conn, :sensor_graph, session_id: session_id)
  end

  def sensor_graph_preview(conn, _params) do
    render(conn, :sensor_graph, session_id: "preview")
  end
end

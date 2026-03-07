defmodule GamepadWeb.SensorGraphChannel do
  use Phoenix.Channel

  alias GamepadWeb.SensorGraphState

  @impl true
  def join("sensor_graph:" <> session_id, _payload, socket) do
    socket = assign(socket, :session_id, session_id)
    if SensorGraphState.connected?(session_id) do
      # Sensor already active; notify this client once the join completes
      send(self(), :notify_connected)
    end
    {:ok, socket}
  end

  @impl true
  def handle_info(:notify_connected, socket) do
    push(socket, "sensor_graph_connected", %{})
    {:noreply, socket}
  end

  @impl true
  def handle_in("sensor_graph_join", _payload, socket) do
    require Logger
    Logger.info("[SensorGraph] sensor_graph_join received for #{socket.assigns.session_id}")
    SensorGraphState.set_connected(socket.assigns.session_id, self())
    broadcast!(socket, "sensor_graph_connected", %{})
    {:noreply, assign(socket, :role, :sensor_graph)}
  end

  def handle_in("orient", %{"alpha" => alpha, "beta" => beta, "gamma" => gamma}, socket) do
    broadcast!(socket, "orient", %{"alpha" => alpha, "beta" => beta, "gamma" => gamma})
    {:noreply, socket}
  end

  def handle_in("motion", %{"ax" => ax, "ay" => ay, "az" => az,
                             "rx" => rx, "ry" => ry, "rz" => rz}, socket) do
    broadcast!(socket, "motion", %{"ax" => ax, "ay" => ay, "az" => az,
                                    "rx" => rx, "ry" => ry, "rz" => rz})
    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, %{assigns: %{role: :sensor_graph}} = socket) do
    if SensorGraphState.disconnect_if_active(socket.assigns.session_id, self()) do
      broadcast!(socket, "sensor_graph_disconnected", %{})
    end
    :ok
  end

  def terminate(_reason, _socket), do: :ok
end

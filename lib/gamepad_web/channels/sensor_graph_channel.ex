defmodule GamepadWeb.SensorGraphChannel do
  use Phoenix.Channel

  @impl true
  def join("sensor_graph:" <> _session_id, _payload, socket), do: {:ok, socket}

  @impl true
  def handle_in("sensor_graph_join", _payload, socket) do
    broadcast!(socket, "sensor_graph_connected", %{})
    {:noreply, assign(socket, :role, :sensor_graph)}
  end

  def handle_in("orient", %{"alpha" => alpha, "beta" => beta, "gamma" => gamma}, socket) do
    broadcast!(socket, "orient", %{"alpha" => alpha, "beta" => beta, "gamma" => gamma})
    {:noreply, socket}
  end

  def handle_in("motion", %{"ax" => ax, "ay" => ay, "az" => az, "rx" => rx, "ry" => ry, "rz" => rz}, socket) do
    broadcast!(socket, "motion", %{"ax" => ax, "ay" => ay, "az" => az, "rx" => rx, "ry" => ry, "rz" => rz})
    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, %{assigns: %{role: :sensor_graph}} = socket) do
    broadcast!(socket, "sensor_graph_disconnected", %{})
    :ok
  end

  def terminate(_reason, _socket), do: :ok
end

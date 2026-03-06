defmodule GamepadWeb.SensorChannel do
  use Phoenix.Channel

  @impl true
  def join("sensor:" <> _session_id, _payload, socket), do: {:ok, socket}

  @impl true
  def handle_in("sensor_join", _payload, socket) do
    broadcast!(socket, "sensor_connected", %{})
    {:noreply, assign(socket, :role, :sensor)}
  end

  def handle_in("accel", %{"x" => x, "y" => y}, socket) do
    broadcast!(socket, "accel", %{"x" => x, "y" => y})
    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, %{assigns: %{role: :sensor}} = socket) do
    broadcast!(socket, "sensor_disconnected", %{})
    :ok
  end

  def terminate(_reason, _socket), do: :ok
end

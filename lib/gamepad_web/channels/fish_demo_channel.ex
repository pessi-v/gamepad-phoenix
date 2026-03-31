defmodule GamepadWeb.FishDemoChannel do
  use Phoenix.Channel, log_handle_in: false

  alias GamepadWeb.FishDemoState

  @impl true
  def join("fish_demo:" <> session_id, _payload, socket) do
    socket = assign(socket, :session_id, session_id)
    if FishDemoState.connected?(session_id) do
      # Sensor already active; notify this client once the join completes
      send(self(), :notify_connected)
    end
    {:ok, socket}
  end

  @impl true
  def handle_info(:notify_connected, socket) do
    push(socket, "fish_demo_connected", %{})
    {:noreply, socket}
  end

  @impl true
  def handle_in("fish_demo_join", _payload, socket) do
    require Logger
    Logger.info("[FishDemo] fish_demo_join received for #{socket.assigns.session_id}")
    FishDemoState.set_connected(socket.assigns.session_id, self())
    broadcast!(socket, "fish_demo_connected", %{})
    {:noreply, assign(socket, :role, :fish_demo)}
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
  def terminate(_reason, %{assigns: %{role: :fish_demo}} = socket) do
    if FishDemoState.disconnect_if_active(socket.assigns.session_id, self()) do
      broadcast!(socket, "fish_demo_disconnected", %{})
    end
    :ok
  end

  def terminate(_reason, _socket), do: :ok
end

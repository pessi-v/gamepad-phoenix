defmodule GamepadWeb.FishChannel do
  use Phoenix.Channel

  @impl true
  def join("fish:" <> _session_id, _payload, socket), do: {:ok, socket}

  @impl true
  def handle_in("fish_join", _payload, socket) do
    broadcast!(socket, "fish_connected", %{})
    {:noreply, assign(socket, :role, :fish)}
  end

  def handle_in("accel", %{"x" => x, "y" => y, "z" => z}, socket) do
    broadcast!(socket, "accel", %{"x" => x, "y" => y, "z" => z})
    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, %{assigns: %{role: :fish}} = socket) do
    broadcast!(socket, "fish_disconnected", %{})
    :ok
  end

  def terminate(_reason, _socket), do: :ok
end

defmodule GamepadWeb.GameChannel do
  use Phoenix.Channel

  @impl true
  def join("game:" <> _session_id, _payload, socket), do: {:ok, socket}

  @impl true
  def handle_in("pad_join", _payload, socket) do
    broadcast!(socket, "pad_connected", %{})
    {:noreply, assign(socket, :role, :pad)}
  end

  def handle_in("stick", %{"x" => x, "y" => y}, socket) do
    broadcast!(socket, "stick", %{"x" => x, "y" => y})
    {:noreply, socket}
  end

  def handle_in("button_down", %{"button" => button}, socket) do
    broadcast!(socket, "button_down", %{"button" => button})
    {:noreply, socket}
  end

  def handle_in("button_up", %{"button" => button}, socket) do
    broadcast!(socket, "button_up", %{"button" => button})
    {:noreply, socket}
  end

  def handle_in("rtc_offer", payload, socket) do
    broadcast_from!(socket, "rtc_offer", payload)
    {:noreply, socket}
  end

  def handle_in("rtc_answer", payload, socket) do
    broadcast_from!(socket, "rtc_answer", payload)
    {:noreply, socket}
  end

  def handle_in("rtc_ice", payload, socket) do
    broadcast_from!(socket, "rtc_ice", payload)
    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, %{assigns: %{role: :pad}} = socket) do
    broadcast!(socket, "pad_disconnected", %{})
    :ok
  end

  def terminate(_reason, _socket), do: :ok
end

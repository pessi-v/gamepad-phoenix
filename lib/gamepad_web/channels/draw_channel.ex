defmodule GamepadWeb.DrawChannel do
  use Phoenix.Channel

  @impl true
  def join("draw:" <> _session_id, _payload, socket), do: {:ok, socket}

  @impl true
  def handle_in("draw_join", _payload, socket) do
    broadcast!(socket, "draw_connected", %{})
    {:noreply, assign(socket, :role, :draw)}
  end

  def handle_in("draw_start", %{"x" => x, "y" => y}, socket) do
    broadcast!(socket, "draw_start", %{"x" => x, "y" => y})
    {:noreply, socket}
  end

  def handle_in("draw_move", %{"x" => x, "y" => y}, socket) do
    broadcast!(socket, "draw_move", %{"x" => x, "y" => y})
    {:noreply, socket}
  end

  def handle_in("draw_end", _payload, socket) do
    broadcast!(socket, "draw_end", %{})
    {:noreply, socket}
  end

  def handle_in("draw_clear", _payload, socket) do
    broadcast!(socket, "draw_clear", %{})
    {:noreply, socket}
  end

  def handle_in("orientation", %{"portrait" => portrait, "ratio" => ratio}, socket) do
    broadcast!(socket, "orientation", %{"portrait" => portrait, "ratio" => ratio})
    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, %{assigns: %{role: :draw}} = socket) do
    broadcast!(socket, "draw_disconnected", %{})
    :ok
  end

  def terminate(_reason, _socket), do: :ok
end

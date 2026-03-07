defmodule GamepadWeb.UserSocket do
  use Phoenix.Socket

  channel "game:*",   GamepadWeb.GameChannel
  channel "sensor:*", GamepadWeb.SensorChannel
  channel "fish:*",   GamepadWeb.FishChannel

  @impl true
  def connect(_params, socket, _connect_info), do: {:ok, socket}

  @impl true
  def id(_socket), do: nil
end

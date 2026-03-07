defmodule GamepadWeb.SensorGraphState do
  use Agent

  def start_link(_opts), do: Agent.start_link(fn -> MapSet.new() end, name: __MODULE__)

  def connected?(session_id),    do: Agent.get(__MODULE__, &MapSet.member?(&1, session_id))
  def set_connected(session_id), do: Agent.update(__MODULE__, &MapSet.put(&1, session_id))
  def set_disconnected(session_id), do: Agent.update(__MODULE__, &MapSet.delete(&1, session_id))
end

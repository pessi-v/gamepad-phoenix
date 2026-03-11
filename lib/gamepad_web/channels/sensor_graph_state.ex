defmodule GamepadWeb.SensorGraphState do
  use Agent

  # State: %{session_id => active_pid}
  def start_link(_opts), do: Agent.start_link(fn -> %{} end, name: __MODULE__)

  def connected?(session_id), do: Agent.get(__MODULE__, &Map.has_key?(&1, session_id))

  def set_connected(session_id, pid),
    do: Agent.update(__MODULE__, &Map.put(&1, session_id, pid))

  # Removes the session only if pid is still the active owner.
  # Returns true if disconnected, false if superseded by a newer connection.
  def disconnect_if_active(session_id, pid) do
    Agent.get_and_update(__MODULE__, fn state ->
      if Map.get(state, session_id) == pid do
        {true, Map.delete(state, session_id)}
      else
        {false, state}
      end
    end)
  end
end

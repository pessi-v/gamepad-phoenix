defmodule GamepadWeb.ScPadController do
  use GamepadWeb, :controller

  def sc_pad(conn, _params) do
    render(conn, :sc_pad)
  end
end

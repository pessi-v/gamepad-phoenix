defmodule Gamepad.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      GamepadWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:gamepad, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Gamepad.PubSub},
      GamepadWeb.FishDemoState,
      # Start a worker by calling: Gamepad.Worker.start_link(arg)
      # {Gamepad.Worker, arg},
      # Start to serve requests, typically the last entry
      GamepadWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Gamepad.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    GamepadWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end

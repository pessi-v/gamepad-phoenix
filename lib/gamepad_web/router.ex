defmodule GamepadWeb.Router do
  use GamepadWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {GamepadWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", GamepadWeb do
    pipe_through :browser

    get "/", PageController, :home
    get "/pad/:session_id", PadController, :pad
    get "/sensor/:session_id", SensorController, :sensor
  end

  if Application.compile_env(:gamepad, :dev_routes) do
    scope "/", GamepadWeb do
      pipe_through :browser

      get "/pad", PadController, :pad_preview
      get "/sensor", SensorController, :sensor_preview
    end
  end

  # Other scopes may use custom stacks.
  # scope "/api", GamepadWeb do
  #   pipe_through :api
  # end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:gamepad, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: GamepadWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end

# Multi-stage build for the Gamepad Phoenix app.
# Builds a self-contained OTP release, then copies it into a slim Debian image.

ARG ELIXIR_VERSION=1.19.5
ARG OTP_VERSION=26.2.5.8
ARG DEBIAN_VERSION=trixie-20260223-slim

ARG BUILDER_IMAGE="hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}"
ARG RUNNER_IMAGE="debian:${DEBIAN_VERSION}"

# ── Build stage ────────────────────────────────────────────────────────────────
FROM ${BUILDER_IMAGE} AS builder

RUN apt-get update -y && \
    apt-get install -y build-essential git && \
    apt-get clean && rm -f /var/lib/apt/lists/*_*

WORKDIR /app

RUN mix local.hex --force && mix local.rebar --force

ENV MIX_ENV=prod
ENV ERL_FLAGS="+JPperf true"

# Fetch deps (esbuild/tailwind are fetched too since they have no only: :dev)
COPY mix.exs mix.lock ./
RUN mix deps.get --only $MIX_ENV

# Copy compile-time config before building assets/app
RUN mkdir config
COPY config/config.exs config/prod.exs config/
RUN mix deps.compile

# Install the esbuild and tailwind binaries used by mix assets.deploy
RUN mix tailwind.install --if-missing && \
    mix esbuild.install --if-missing

# Build and digest assets
COPY priv priv
COPY assets assets
COPY lib lib
RUN mix assets.deploy

# Compile the app
RUN mix compile

# Copy runtime config last so changes to it don't bust the compile cache
COPY config/runtime.exs config/

# Build the OTP release
RUN mix release

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM ${RUNNER_IMAGE}

RUN apt-get update -y && \
    apt-get install -y libstdc++6 openssl libncurses6 locales ca-certificates && \
    apt-get clean && rm -f /var/lib/apt/lists/*_*

RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen

ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8 \
    MIX_ENV=prod \
    PHX_SERVER=true

WORKDIR /app
RUN chown nobody /app

COPY --from=builder --chown=nobody:root /app/_build/prod/rel/gamepad ./

USER nobody

EXPOSE 4000
CMD ["/app/bin/gamepad", "start"]

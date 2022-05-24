# frozen_string_literal: true

module DInstaller
  module DBus
    # Namespace for Clients for DBus API.
    # It provides API to be called from other services.
    # E.g. Users class is used from other services to call Users DBus API.
    module Clients
    end
  end
end

require "dinstaller/dbus/clients/dinstaller"
require "dinstaller/dbus/clients/users"

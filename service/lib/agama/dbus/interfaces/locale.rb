# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "yast"
require "dbus"

Yast.import "WFM"

module Agama
  module DBus
    module Interfaces
      # Mixin to define the Locale interface.
      #
      # @note This mixin is expected to be included in a class that inherits from {DBus::BaseObject}
      # and it requires a #locale= method that sets the service's locale.
      module Locale
        include Yast::I18n
        include Yast::Logger

        LOCALE_INTERFACE = "org.opensuse.Agama1.LocaleMixin"

        def self.included(base)
          base.class_eval do
            dbus_interface LOCALE_INTERFACE do
              # It expects a locale (en_US.UTF-8) as argument.
              dbus_method :SetLocale, "in locale:s" do |locale|
                self.locale = locale
              end
            end
          end
        end
      end
    end
  end
end

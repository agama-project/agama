# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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

require "agama/dbus/clients/base"

module Agama
  module DBus
    module Clients
      # D-Bus client for asking a question.
      class Question < Base
        WITH_PASSWORD_IFACE = "org.opensuse.Agama.Questions1.WithPassword"
        private_constant :WITH_PASSWORD_IFACE

        # @return [::DBus::ProxyObject]
        attr_reader :dbus_object

        # @param [::DBus::ObjectPath] object_path
        def initialize(object_path)
          super()

          @dbus_object = service[object_path]
          @dbus_iface = @dbus_object["org.opensuse.Agama.Questions1.Generic"]
          # one D-Bus client for all kinds of questions
          return unless @dbus_object.has_iface?(WITH_PASSWORD_IFACE)

          @password_iface = @dbus_object[WITH_PASSWORD_IFACE]
        end

        # @return [String]
        def service_name
          @service_name ||= "org.opensuse.Agama.Questions1"
        end

        # @return [String] Question text
        def text
          @dbus_iface["Text"].to_s
        end

        # @return [Symbol] no answer yet = :""
        def answer
          @dbus_iface["Answer"].to_sym
        end

        # @return [String,nil] Password or nil if there is no LUKS interface
        def password
          return nil unless @luks_iface

          @luks_iface["Password"]
        end

        # Whether the question is already answered
        #
        # @return [Boolean]
        def answered?
          answer != :""
        end
      end
    end
  end
end

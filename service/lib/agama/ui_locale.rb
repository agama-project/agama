# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

Yast.import "WFM"

module Agama
  # Object responsible for managing changes of localization produced by D-Bus backend.
  class UILocale
    include Yast::I18n
    include Yast::Logger
    # creates new UILocale object that will handle change of UI locale.
    #
    # @param [Agama::DBus::Clients::Locale] locale_client to communicate with dbus service
    # @yield block is callback that is called when ui locale is changed
    #   to allow user to call methods that needs retranslation
    def initialize(locale_client, &block)
      @client = locale_client
      change_locale(@client.ui_locale)
      @client.on_ui_locale_change do |locale|
        change_locale(locale)
        block.call(locale) if block_given?
      end
    end

  private

    def change_locale(locale)
      language, encoding = locale.split(".")
      Yast::WFM.SetLanguage(language, encoding)
      # explicitly set ENV to get localization also from libraries like libstorage
      ENV["LANG"] = locale
      log.info "set yast locale to #{locale}"
      # explicit call to textdomain to force fast gettext change of language ASAP
      textdomain "installation"
    end
  end
end

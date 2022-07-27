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

require "thor"
require "dinstaller/clients/language"

module DInstallerCli
  module Commands
    # Subcommand to manage language settings
    class Language < Thor
      desc "available", "List available languages for the installation"
      def available
        languages = client.available_languages.map { |l| l.join(" - ") }
        languages.each { |l| say(l) }
      end

      desc "selected [<id>...]", "Select the languages to install in the target system"
      long_desc "Use without arguments to see the currently selected languages."
      def selected(*ids)
        client.select_languages(ids) if ids.any?
        client.selected_languages.each { |l| say(l) }
      end

    private

      def client
        @client ||= DInstaller::DBus::Clients::Language.new
      end
    end
  end
end

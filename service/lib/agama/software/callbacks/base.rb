# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

module Agama
  module Software
    module Callbacks
      # Base class for libzypp callbacks for sharing some common texts.
      class Base
        include Yast::I18n

        # Constructor
        #
        # @param questions_client [Agama::HTTP::Clients::Questions]
        # @param logger [Logger]
        def initialize(questions_client, logger)
          textdomain "agama"
          @questions_client = questions_client
          @logger = logger || ::Logger.new($stdout)
        end

        def setup
          raise NotImplementedError
        end

        # label for the "retry" action
        def retry_label
          # TRANSLATORS: button label, try downloading the failed package again
          _("Try again")
        end

        # label for the "continue" action
        def continue_label
          # TRANSLATORS: button label, ignore the failed download, skip package installation
          _("Continue anyway")
        end

        # label for the "abort" action
        def abort_label
          # TRANSLATORS: button label, abort the installation completely after an error
          _("Abort installation")
        end

        # label for the "skip" action
        def skip_label
          # TRANSLATORS: button label, skip the error
          _("Skip")
        end

        # label for the "yes" action
        def yes_label
          # TRANSLATORS: button label
          _("Yes")
        end

        # label for the "no" action
        def no_label
          # TRANSLATORS: button label
          _("No")
        end

      private

        # @return [Agama::HTTP::Clients::Questions]
        attr_reader :questions_client

        # @return [Logger]
        attr_reader :logger
      end
    end
  end
end

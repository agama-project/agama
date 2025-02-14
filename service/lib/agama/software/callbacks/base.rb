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
        def initialize
          textdomain "agama"
        end

        # separator between multiple messages
        def separator
          "\n\n"
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

        # dialog title
        def title
          # TRANSLATORS: Dialog title
          _("Package installation failed")
        end

        # append a warning about possible broken system to the error message
        # @param message [String] input message
        def broken_system_warning(message)
          # TRANSLATORS: warning message, you can use multiple lines
          message + separator + _("Continuing without installing the package can result in " \
                                  "a broken system.\nIn some cases the system might not even boot.")
        end
      end
    end
  end
end

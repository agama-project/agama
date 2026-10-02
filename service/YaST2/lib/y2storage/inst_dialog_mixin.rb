# Copyright (c) [2017] SUSE LLC
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
Yast.import "Wizard"

module Y2Storage
  # Mixin providing some simple helpers to deal with dialogs that have special
  # requirements when used during installation, mainly the expert partitioner.
  module InstDialogMixin
    # Runs the given block temporarily disabling the titleOnLeft option that is
    # by default applied to the installation wizard, so dialogs opened within
    # the block can use the full screen.
    #
    # @example
    #   dialog = Y2Partitioner::Dialogs.main.new
    #   dialog_result = without_title_on_left do
    #     dialog.run
    #   end
    def without_title_on_left(&block)
      Yast::Wizard.OpenNextBackDialog
      block.call
    ensure
      Yast::Wizard.CloseDialog
    end
  end
end

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

module Agama
  module Software
    # Namespace for software callbacks
    module Callbacks
    end
  end
end

require "agama/software/callbacks/digest"
require "agama/software/callbacks/media"
require "agama/software/callbacks/pkg_gpg_check"
require "agama/software/callbacks/progress"
require "agama/software/callbacks/provide"
require "agama/software/callbacks/script"
require "agama/software/callbacks/signature"

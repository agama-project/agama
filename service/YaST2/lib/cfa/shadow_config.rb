# Copyright (c) [2019] SUSE LLC
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
require "cfa/login_defs"
require "cfa/multi_file_config"

Yast.import "FileUtils"

module CFA
  # This class allows to interact with the shadow suite configuration files (login.defs)
  #
  # @example Reading a configuration parameter
  #   config = ShadowConfig.new
  #   config.load
  #   config.encrypt_method #=> "SHA512"
  #
  # @example Setting a value
  #   config = ShadowConfig.new
  #   config.load
  #   config.fail_delay = "5"
  #   config.save
  class ShadowConfig < MultiFileConfig
    self.file_name = "login.defs"
    self.yast_file_name = "70-yast.defs"
    self.file_class = LoginDefs
  end
end

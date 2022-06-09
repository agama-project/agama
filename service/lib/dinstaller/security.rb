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
require "y2security/lsm"
require "yast2/execute"

require "dinstaller/config"

# FIXME: monkey patching of security config to not read control.xml and
# instead use DIinstaller::Config
# TODO: add ability to set product features in LSM::Base
module Y2Security
  module LSM
    # modified LSM Base class to use dinstaller config
    class Base
      def product_feature_settings
        return @product_feature_settings unless @product_feature_settings.nil?

        value = DIinstaller::Config.current.data["security"]["available_lsms"][id.to_s]
        res = if value
          {
            selectable:   true,
            configurable: true,
            patterns:     (value["patterns"] || []).join(" "),
            mode:         value["policy"]
          }
        else
          {
            selectable:   false,
            configurable: false,
            patterns:     "",
            mode:         nil
          }
        end
        @product_feature_settings = res
      end
    end
  end
end

module DInstaller
  # Backend class between dbus service and yast code
  class Security
    def initialize(logger, config)
      @config = config
      @logger = logger
    end

    def write(_progress)
      config.save
    end

    def probe(_progress)
      config.select(@config.data["security"]["lsm"])
    end

  private

    def config
      Y2Security::LSM::Config.instance
    end
  end
end

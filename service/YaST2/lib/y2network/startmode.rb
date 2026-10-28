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

# Vendored from yast2-network's network/src/lib/y2network/startmode.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "yast"
require "yast2/equatable"

module Y2Network
  # Base class for startmode. It allows to create new one according to name or anlist all.
  # Its child have to define `to_human_string` method and possibly its own specialized attributes.
  # TODO: as backends differs, we probably also need to have flag there to which backends
  #   mode exists
  class Startmode
    include Yast2::Equatable
    include Yast::Logger

    # To be backward compliant 'boot', 'on' and 'onboot' are aliases
    # for 'auto' (bsc#1186910)
    ALIASES = {
      "boot"   => "auto",
      "onboot" => "auto",
      "on"     => "auto"
    }.freeze

    attr_reader :name
    attr_reader :alias_name

    alias_method :to_s, :name

    eql_attr :name, :alias_name

    def initialize(name, alias_name: nil)
      @name = name
      @alias_name = alias_name
    end

    # gets new instance of startmode for given type and its params
    def self.create(mode)
      name = ALIASES[mode] || mode
      alias_name = ALIASES[mode] ? mode : nil

      # avoid circular dependencies
      require "y2network/startmodes"
      const = Startmodes.const_get(name.capitalize)
      alias_name ? const.new(alias_name: alias_name) : const.new
    rescue NameError => e
      log.error "Invalid startmode #{e.inspect}"
      nil
    end

    def self.all
      require "y2network/startmodes"
      Startmodes.constants.map { |c| Startmodes.const_get(c).new }
    end
  end
end

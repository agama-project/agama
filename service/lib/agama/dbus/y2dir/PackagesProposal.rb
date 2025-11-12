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
require "agama/http/clients/main"

# :nodoc:
module Yast
  # Replacement for the Yast::PackagesProposal module
  class PackagesProposalClass < Module
    def main
      puts "Loading mocked module #{__FILE__}"
      @client = Agama::HTTP::Clients::Main.new(::Logger.new($stdout))
    end

    # @see https://github.com/yast/yast-yast2/blob/b8cd178b7f341f6e3438782cb703f4a3ab0529ed/library/general/src/modules/PackagesProposal.rb#L118
    def AddResolvables(unique_id, type, resolvables, optional: false)
      orig_resolvables = client.get_resolvables(unique_id, type, optional: optional)
      orig_resolvables += resolvables
      orig_resolvables.uniq!
      SetResolvables(unique_id, type, orig_resolvables, optional: optional)
      true
    end

    # @see https://github.com/yast/yast-yast2/blob/b8cd178b7f341f6e3438782cb703f4a3ab0529ed/library/general/src/modules/PackagesProposal.rb#L145
    def SetResolvables(unique_id, type, resolvables, optional: false)
      client.set_resolvables(unique_id, type, resolvables || [])
      true
    end

    # @see https://github.com/yast/yast-yast2/blob/b8cd178b7f341f6e3438782cb703f4a3ab0529ed/library/general/src/modules/PackagesProposal.rb#L285
    def GetResolvables(unique_id, type, optional: false)
      client.get_resolvables(unique_id, type, optional)
    end

    # @see https://github.com/yast/yast-yast2/blob/b8cd178b7f341f6e3438782cb703f4a3ab0529ed/library/general/src/modules/PackagesProposal.rb#L177
    def RemoveResolvables(unique_id, type, resolvables, optional: false)
      orig_resolvables = client.get_resolvables(unique_id, type, optional: optional)
      orig_resolvables -= resolvables
      orig_resolvables.uniq!
      SetResolvables(unique_id, type, orig_resolvables, optional: optional)
      true
    end

  private

    attr_reader :client
  end

  PackagesProposal = PackagesProposalClass.new
  PackagesProposal.main
end

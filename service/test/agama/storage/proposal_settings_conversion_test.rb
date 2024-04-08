# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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

require_relative "../../test_helper"
require "agama/config"
require "agama/storage/proposal_settings"
require "agama/storage/proposal_settings_conversion"
require "y2storage"

describe Agama::Storage::ProposalSettingsConversion do
  describe "#from_y2storage" do
    let(:y2storage_settings) { Y2Storage::ProposalSettings.new }

    let(:settings) { Agama::Storage::ProposalSettings.new }

    it "generates proposal settings from Y2Storage settings" do
      result = described_class.from_y2storage(y2storage_settings, settings)
      expect(result).to be_a(Agama::Storage::ProposalSettings)
    end
  end

  describe "#to_y2storage" do
    let(:config) { Agama::Config.new }

    let(:settings) { Agama::Storage::ProposalSettings.new }

    it "generates Y2Storage settings from proposal settings" do
      result = described_class.to_y2storage(settings, config: config)
      expect(result).to be_a(Y2Storage::ProposalSettings)
    end
  end
end

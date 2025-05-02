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

require_relative "../storage_helpers"
require_relative "./context"
require "agama/storage/config_checkers/alias"

shared_examples "overused alias issue" do
  it "includes the expected issue" do
    issues = subject.issues
    expect(issues).to include an_object_having_attributes(
      error?:      true,
      kind:        :overused_alias,
      description: /alias '#{device_alias}' is used by more than one/
    )
  end
end

shared_examples "several MD RAID users" do
  let(:device_alias) { "device1" }

  context "if it is used by more than one MD RAID" do
    let(:md_raids) do
      [
        { devices: [device_alias] },
        { devices: [device_alias] }
      ]
    end

    include_examples "overused alias issue"
  end
end

shared_examples "several volume group users" do
  let(:device_alias) { "device1" }

  context "if it is used by more than one volume group" do
    let(:volume_groups) do
      [
        { physicalVolumes: [device_alias] },
        { physicalVolumes: [device_alias] }
      ]
    end

    include_examples "overused alias issue"
  end
end

shared_examples "several users" do
  let(:device_alias) { "device1" }

  context "if it is used by a MD RAID and by a volume group" do
    let(:md_raids) do
      [
        { devices: [device_alias] }
      ]
    end

    let(:volume_groups) do
      [
        { physicalVolumes: [device_alias] }
      ]
    end

    include_examples "overused alias issue"
  end
end

describe Agama::Storage::ConfigCheckers::Alias do
  include_context "checker"

  subject { described_class.new(device_config, config) }

  describe "#issues" do
    context "for a drive" do
      let(:config_json) do
        {
          drives:       [
            { alias: device_alias }
          ],
          mdRaids:      md_raids,
          volumeGroups: volume_groups
        }
      end

      let(:md_raids) { nil }
      let(:volume_groups) { nil }

      let(:device_config) { config.drives.first }

      include_examples "several MD RAID users"
      include_examples "several volume group users"
      include_examples "several users"
    end

    context "for a partition" do
      let(:config_json) do
        {
          drives:       [
            {
              partitions: [
                { alias: device_alias }
              ]
            }
          ],
          mdRaids:      md_raids,
          volumeGroups: volume_groups
        }
      end

      let(:md_raids) { nil }
      let(:volume_groups) { nil }

      let(:device_config) { config.drives.first.partitions.first }

      include_examples "several MD RAID users"
      include_examples "several volume group users"
      include_examples "several users"
    end

    context "for a MD RAID" do
      let(:config_json) do
        {
          mdRaids:      [
            { alias: device_alias }
          ],
          volumeGroups: volume_groups
        }
      end

      let(:volume_groups) { nil }

      let(:device_config) { config.md_raids.first }

      include_examples "several volume group users"
    end
  end
end

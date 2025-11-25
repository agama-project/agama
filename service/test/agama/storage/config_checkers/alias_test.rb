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

require_relative "../config_context"
require "agama/storage/config_checkers/alias"

shared_examples "overused alias issue" do
  it "includes the expected issue" do
    issues = subject.issues
    expect(issues).to include an_object_having_attributes(
      kind:        Agama::Storage::IssueClasses::Config::ALIAS,
      description: /alias '#{device_alias}' is used by more than one/
    )
  end
end

shared_examples "several MD RAID users" do
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

shared_examples "MD RAID user and target user" do
  context "if it is used by a MD RAID and it is target for boot partitions" do
    let(:boot) do
      {
        configure: true,
        device:    device_alias
      }
    end

    let(:md_raids) do
      [
        { devices: [device_alias] }
      ]
    end

    include_examples "overused alias issue"
  end

  context "if it is used by a MD RAID and it is target for physical volumes" do
    let(:md_raids) do
      [
        { devices: [device_alias] }
      ]
    end

    let(:volume_groups) do
      [
        { physicalVolumes: [{ generate: [device_alias] }] }
      ]
    end

    include_examples "overused alias issue"
  end
end

shared_examples "Volume group user and target user" do
  context "if it is used by a volume group and it is target for boot partitions" do
    let(:boot) do
      {
        configure: true,
        device:    device_alias
      }
    end

    let(:volume_groups) do
      [
        { physicalVolumes: [device_alias] }
      ]
    end

    include_examples "overused alias issue"
  end

  context "if it is used by a volume group and it is target for physical volumes" do
    let(:volume_groups) do
      [
        { physicalVolumes: [device_alias] },
        { physicalVolumes: [{ generate: [device_alias] }] }
      ]
    end

    include_examples "overused alias issue"
  end
end

shared_examples "formatted and used issue" do
  it "includes the expected issue" do
    issues = subject.issues
    expect(issues).to include an_object_having_attributes(
      kind:        Agama::Storage::IssueClasses::Config::OVERUSED,
      description: /alias '#{device_alias}' cannot be formatted because it is used/
    )
  end
end

shared_examples "formatted and MD RAID user" do
  context "if it is formatted" do
    let(:filesystem) { { path: "/" } }

    context "and it is used by a MD RAID" do
      let(:md_raids) do
        [
          { devices: [device_alias] }
        ]
      end

      include_examples "formatted and used issue"
    end
  end
end

shared_examples "formatted and volume group user" do
  context "if it is formatted" do
    let(:filesystem) { { path: "/" } }

    context "and it is used by a volume group" do
      let(:volume_groups) do
        [
          { physicalVolumes: [device_alias] }
        ]
      end

      include_examples "formatted and used issue"
    end
  end
end

shared_examples "formatted and volume group target user" do
  context "if it is formatted" do
    let(:filesystem) { { path: "/" } }

    context "and it is used as target by a volume group" do
      let(:volume_groups) do
        [
          { physicalVolumes: [{ generate: [device_alias] }] }
        ]
      end

      include_examples "formatted and used issue"
    end
  end
end

shared_examples "formatted and boot target user" do
  context "if it is formatted" do
    let(:filesystem) { { path: "/" } }

    context "and it is used as target for boot partitions" do
      let(:boot) do
        {
          configure: true,
          device:    device_alias
        }
      end

      include_examples "formatted and used issue"
    end
  end
end

shared_examples "partitioned and used issue" do
  it "includes the expected issue" do
    issues = subject.issues
    expect(issues).to include an_object_having_attributes(
      kind:        Agama::Storage::IssueClasses::Config::OVERUSED,
      description: /alias '#{device_alias}' cannot be partitioned because it is used/
    )
  end
end

shared_examples "partitioned and MD RAID user" do
  context "if it is partitioned" do
    let(:partitions) do
      [
        { path: "/" }
      ]
    end

    context "and it is used by a MD RAID" do
      let(:md_raids) do
        [
          { devices: [device_alias] }
        ]
      end

      include_examples "partitioned and used issue"
    end
  end
end

shared_examples "partitioned and volume group user" do
  context "if it is partitioned" do
    let(:partitions) do
      [
        { path: "/" }
      ]
    end

    context "and it is used by a volume group" do
      let(:volume_groups) do
        [
          { physicalVolumes: [device_alias] }
        ]
      end

      include_examples "partitioned and used issue"
    end
  end
end

describe Agama::Storage::ConfigCheckers::Alias do
  include_context "config"

  subject { described_class.new(device_config, config) }

  describe "#issues" do
    context "for a drive" do
      let(:config_json) do
        {
          boot:         boot,
          drives:       [
            {
              alias:      device_alias,
              filesystem: filesystem,
              partitions: partitions
            }
          ],
          mdRaids:      md_raids,
          volumeGroups: volume_groups
        }
      end

      let(:boot) { nil }
      let(:device_alias) { "disk1" }
      let(:filesystem) { nil }
      let(:partitions) { nil }
      let(:md_raids) { nil }
      let(:volume_groups) { nil }

      let(:device_config) { config.drives.first }

      include_examples "several MD RAID users"
      include_examples "several volume group users"
      include_examples "several users"
      include_examples "MD RAID user and target user"
      include_examples "Volume group user and target user"
      include_examples "formatted and MD RAID user"
      include_examples "formatted and volume group user"
      include_examples "formatted and volume group target user"
      include_examples "formatted and boot target user"
      include_examples "partitioned and MD RAID user"
      include_examples "partitioned and volume group user"
    end

    context "for a drive partition" do
      let(:config_json) do
        {
          drives:       [
            {
              partitions: [
                {
                  alias:      device_alias,
                  filesystem: filesystem
                }
              ]
            }
          ],
          mdRaids:      md_raids,
          volumeGroups: volume_groups
        }
      end

      let(:device_alias) { "p1" }
      let(:filesystem) { nil }
      let(:md_raids) { nil }
      let(:volume_groups) { nil }

      let(:device_config) { config.drives.first.partitions.first }

      include_examples "several MD RAID users"
      include_examples "several volume group users"
      include_examples "several users"
      include_examples "formatted and MD RAID user"
      include_examples "formatted and volume group user"
    end

    context "for a MD RAID" do
      let(:config_json) do
        {
          boot:         boot,
          mdRaids:      [
            {
              alias:      device_alias,
              filesystem: filesystem,
              partitions: partitions
            }
          ],
          volumeGroups: volume_groups
        }
      end

      let(:boot) { nil }
      let(:device_alias) { "md1" }
      let(:filesystem) { nil }
      let(:partitions) { nil }
      let(:volume_groups) { nil }

      let(:device_config) { config.md_raids.first }

      include_examples "several volume group users"
      include_examples "Volume group user and target user"
      include_examples "formatted and volume group user"
      include_examples "formatted and volume group target user"
      include_examples "formatted and boot target user"
      include_examples "partitioned and volume group user"
    end

    context "for a MD RAID partition" do
      let(:config_json) do
        {
          mdRaids:      [
            {
              partitions: [
                {
                  alias:      device_alias,
                  filesystem: filesystem
                }
              ]
            }
          ],
          volumeGroups: volume_groups
        }
      end

      let(:device_alias) { "p1" }
      let(:filesystem) { nil }
      let(:volume_groups) { nil }

      let(:device_config) { config.md_raids.first.partitions.first }

      include_examples "several volume group users"
      include_examples "formatted and volume group user"
    end
  end
end

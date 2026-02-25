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
require_relative "./examples"
require "agama/storage/config_checkers/md_raid"

describe Agama::Storage::ConfigCheckers::MdRaid do
  include_context "config"

  subject { described_class.new(md_config, config, product_config) }

  let(:config_json) do
    {
      drives:       drives,
      mdRaids:      [
        {
          alias:      device_alias,
          search:     search,
          level:      level,
          filesystem: filesystem,
          encryption: encryption,
          partitions: partitions,
          devices:    devices
        }
      ],
      volumeGroups: volume_groups
    }
  end

  let(:drives) { [{ alias: "disk1" }] }
  let(:device_alias) { nil }
  let(:search) { nil }
  let(:level) { nil }
  let(:filesystem) { nil }
  let(:encryption) { nil }
  let(:partitions) { nil }
  let(:devices) { nil }
  let(:volume_groups) { nil }

  let(:md_config) { config.md_raids.first }

  describe "#issues" do
    include_examples "alias issues"
    include_examples "search issues"
    include_examples "filesystem issues"
    include_examples "encryption issues"
    include_examples "partitions issues"

    context "if the MD RAID has no level" do
      let(:level) { nil }

      before { solve_config }

      context "and the device is going to be created" do
        let(:search) { nil }

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues).to include an_object_having_attributes(
            kind:        Agama::Storage::IssueClasses::Config::NO_RAID_LEVEL,
            description: /MD RAID without level/
          )
        end
      end

      context "and the device is not going to be created" do
        let(:search) do
          {
            condition:  { name: "/dev/md1" },
            ifNotFound: "error"
          }
        end

        it "does not include the issue" do
          issues = subject.issues
          expect(issues).to_not include an_object_having_attributes(
            kind: Agama::Storage::IssueClasses::Config::NO_RAID_LEVEL
          )
        end
      end
    end

    context "if the MD RAID has not enough member devices" do
      let(:level) { "raid0" }
      let(:devices) { ["disk1", "disk1"] }

      before { solve_config }

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::WRONG_RAID_MEMBERS,
          description: "At least 2 devices are required for raid0"
        )
      end
    end

    context "if the MD RAID has an unknown member device" do
      let(:devices) { ["disk1", "disk2"] }

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::NO_SUCH_ALIAS,
          description: /no MD RAID member device with alias 'disk2'/
        )
      end
    end

    context "if the MD RAID is reused" do
      let(:scenario) { "md_disks.yaml" }
      let(:search) { "/dev/md0" }

      before { solve_config }

      context "and there is a config reusing a device member" do
        let(:drives) do
          [
            {
              alias:      "vda",
              search:     "/dev/vda",
              filesystem: member_filesystem,
              partitions: member_partitions
            }
          ]
        end

        let(:member_filesystem) { nil }
        let(:member_partitions) { nil }

        context "and the member config has filesystem" do
          let(:member_filesystem) { { path: "/" } }

          it "includes the expected issue" do
            issues = subject.issues
            expect(issues).to include an_object_having_attributes(
              kind:        Agama::Storage::IssueClasses::Config::MISUSED_MD_MEMBER,
              description: /.*vda.*cannot be formatted.*part of.*md0/
            )
          end
        end

        context "and the member config has partitions" do
          let(:member_partitions) do
            [
              {
                filesystem: { path: "/" }
              }
            ]
          end

          it "includes the expected issue" do
            issues = subject.issues
            expect(issues).to include an_object_having_attributes(
              kind:        Agama::Storage::IssueClasses::Config::MISUSED_MD_MEMBER,
              description: /.*vda.*cannot be partitioned.*part of.*md0/
            )
          end
        end

        context "and the member config is used by other device" do
          let(:volume_groups) do
            [
              {
                physicalVolumes: ["vda"]
              }
            ]
          end

          it "includes the expected issue" do
            issues = subject.issues
            expect(issues).to include an_object_having_attributes(
              kind:        Agama::Storage::IssueClasses::Config::MISUSED_MD_MEMBER,
              description: /.*vda.*cannot be used.*part of.*md0/
            )
          end
        end

        context "and the member config is deleted" do
          let(:scenario) { "md_raids.yaml" }

          let(:drives) do
            [
              {
                search:     "/dev/vda",
                partitions: [
                  {
                    search: "/dev/vda1",
                    delete: true
                  }
                ]
              }
            ]
          end

          it "includes the expected issue" do
            issues = subject.issues
            expect(issues).to include an_object_having_attributes(
              kind:        Agama::Storage::IssueClasses::Config::MISUSED_MD_MEMBER,
              description: /.*vda1.*cannot be deleted.*part of.*md0/
            )
          end
        end

        context "and the member config is resized" do
          let(:scenario) { "md_raids.yaml" }

          let(:drives) do
            [
              {
                search:     "/dev/vda",
                partitions: [
                  {
                    search: "/dev/vda1",
                    size:   "2 GiB"
                  }
                ]
              }
            ]
          end

          it "includes the expected issue" do
            issues = subject.issues
            expect(issues).to include an_object_having_attributes(
              kind:        Agama::Storage::IssueClasses::Config::MISUSED_MD_MEMBER,
              description: /.*vda1.*cannot be resized.*part of.*md0/
            )
          end
        end
      end

      context "and a member is indirectly deleted (i.e., the drive is formatted)" do
        let(:scenario) { "md_raids.yaml" }

        let(:drives) do
          [
            {
              search:     "/dev/vda",
              filesystem: { path: "/data" }
            }
          ]
        end

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues).to include an_object_having_attributes(
            kind:        Agama::Storage::IssueClasses::Config::MISUSED_MD_MEMBER,
            description: /.*vda.*cannot be formatted.*part of.*md0/
          )
        end
      end
    end

    context "if the MD RAID is valid" do
      let(:config_json) do
        {
          drives:       [
            { alias: "md-disk" },
            { alias: "md-disk" }
          ],
          mdRaids:      [
            {
              alias:   "md",
              level:   "raid0",
              devices: ["md-disk"]
            }
          ],
          volumeGroups: [
            {
              name:            "vg",
              physicalVolumes: ["md"]
            }
          ]
        }
      end

      before { solve_config }

      it "does not report issues" do
        expect(subject.issues).to eq([])
      end
    end

    context "if the reused MD RAID is valid" do
      let(:scenario) { "md_disks.yaml" }

      let(:config_json) do
        {
          mdRaids: [
            { search: "/dev/md0" }
          ]
        }
      end

      before { solve_config }

      it "does not report issues" do
        expect(subject.issues).to eq([])
      end
    end
  end
end

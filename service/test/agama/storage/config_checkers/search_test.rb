# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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
require "agama/storage/config_checkers/search"
require "agama/storage/issue_classes"

describe Agama::Storage::ConfigCheckers::Search do
  include_context "config"

  subject { described_class.new(device_config, config) }

  describe "#issues" do
    before { solve_config }

    let(:config_json) do
      {
        drives: [
          { search: search }
        ]
      }
    end

    let(:scenario) { "disks.yaml" }
    let(:search) { nil }
    let(:device_config) { config.drives.first }

    context "if the device is not found" do
      let(:search) do
        {
          condition:  { name: "/dev/unknown" },
          ifNotFound: if_not_found
        }
      end

      context "and the device can be skipped" do
        let(:if_not_found) { "skip" }

        it "does not include any issue" do
          expect(subject.issues).to be_empty
        end
      end

      context "and the device should be created instead" do
        let(:if_not_found) { "create" }

        it "does not include any issue" do
          expect(subject.issues).to be_empty
        end
      end

      context "and the device cannot be skipped or created" do
        let(:if_not_found) { "error" }

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues).to include an_object_having_attributes(
            kind:        Agama::Storage::IssueClasses::Config::SEARCH_NOT_FOUND,
            description: "Mandatory device /dev/unknown not found"
          )
        end
      end
    end

    context "if the search condition is not a device name" do
      let(:search) do
        {
          condition:  { size: { greater: "10 TiB" } },
          ifNotFound: "error"
        }
      end

      it "includes a generic not found issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::SEARCH_NOT_FOUND,
          description: "Mandatory drive not found"
        )
      end
    end

    context "if the search condition is an operator" do
      let(:search) do
        {
          condition:  {
            and: [
              { name: "/dev/unknown" },
              { size: { greater: "1 GiB" } }
            ]
          },
          ifNotFound: "error"
        }
      end

      it "includes a generic not found issue without the nested name" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::SEARCH_NOT_FOUND,
          description: "Mandatory drive not found"
        )
      end
    end

    context "if a MD RAID is reused" do
      let(:config_json) do
        {
          drives:       drives,
          mdRaids:      [
            {
              search:     search,
              filesystem: filesystem,
              encryption: encryption,
              partitions: partitions
            }
          ],
          volumeGroups: volume_groups
        }
      end

      let(:drives) { nil }
      let(:search) { "/dev/md0" }
      let(:filesystem) { nil }
      let(:encryption) { nil }
      let(:partitions) { nil }
      let(:volume_groups) { nil }

      let(:scenario) { "md_disks.yaml" }
      let(:device_config) { config.md_raids.first }

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
              description: /.*vda.*cannot be formatted.*part of.* MD RAID .*md0/
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
              description: /.*vda.*cannot be partitioned.*part of.* MD RAID .*md0/
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
              description: /.*vda.*cannot be used.*part of.* MD RAID .*md0/
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
              description: /.*vda1.*cannot be deleted.*part of.* MD RAID .*md0/
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
              description: /.*vda1.*cannot be resized.*part of.* MD RAID .*md0/
            )
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
              description: /.*vda.*cannot be formatted.*part of.* MD RAID .*md0/
            )
          end
        end
      end
    end

    context "if a volume group is reused" do
      let(:config_json) do
        {
          drives:       drives,
          volumeGroups: volume_groups,
          mdRaids:      md_raids
        }
      end

      let(:drives) { [] }
      let(:md_raids) { [] }

      let(:volume_groups) do
        [
          { search: "/dev/vg0" }
        ]
      end

      let(:device_config) { config.volume_groups.first }
      let(:scenario) { "lvm-over-raids.yaml" }

      context "and there is a config reusing a physical volume" do
        let(:md_raids) do
          [
            {
              alias:      "md0",
              search:     "/dev/md0",
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
              kind:        Agama::Storage::IssueClasses::Config::MISUSED_PV,
              description: /.*md0.*cannot be formatted.*physical volume of .*volume group .*vg0/
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
              kind:        Agama::Storage::IssueClasses::Config::MISUSED_PV,
              description: /.*md0.*cannot be partitioned.*physical volume of.*volume group .*vg0/
            )
          end
        end

        context "and the member config is used by other device" do
          let(:volume_groups) do
            [
              { search: "/dev/vg0" },
              { physicalVolumes: ["md0"] }
            ]
          end

          it "includes the expected issue" do
            issues = subject.issues
            expect(issues).to include an_object_having_attributes(
              kind:        Agama::Storage::IssueClasses::Config::MISUSED_PV,
              description: /.*md0.*cannot be used.*physical volume of.*volume group .*vg0/
            )
          end
        end

        context "and the member config is deleted" do
          let(:scenario) { "several_vgs.yaml" }

          let(:drives) do
            [
              {
                search:     "/dev/sda",
                partitions: [
                  {
                    search: "/dev/sda3",
                    delete: true
                  }
                ]
              }
            ]
          end

          let(:volume_groups) do
            [
              { search: "/dev/data" }
            ]
          end

          it "includes the expected issue" do
            issues = subject.issues
            expect(issues).to include an_object_having_attributes(
              kind:        Agama::Storage::IssueClasses::Config::MISUSED_PV,
              description: /.*sda3.*cannot be deleted.*physical volume of.* volume group .*data/
            )
          end
        end

        context "and the member config is resized" do
          let(:scenario) { "several_vgs.yaml" }

          let(:drives) do
            [
              {
                search:     "/dev/sda",
                partitions: [
                  {
                    search: "/dev/sda3",
                    size:   "2 GiB"
                  }
                ]
              }
            ]
          end

          let(:volume_groups) do
            [
              { search: "/dev/data" }
            ]
          end

          it "includes the expected issue" do
            issues = subject.issues
            expect(issues).to include an_object_having_attributes(
              kind:        Agama::Storage::IssueClasses::Config::MISUSED_PV,
              description: /.*sda3.*cannot be resized.*physical volume of.* volume group .*data/
            )
          end
        end

        context "and a member is indirectly deleted (parent device is formatted)" do
          let(:scenario) { "several_vgs.yaml" }

          let(:drives) do
            [
              {
                search:     "/dev/sda",
                filesystem: { path: "/data" }
              }
            ]
          end

          let(:volume_groups) do
            [
              { search: "/dev/data" }
            ]
          end

          it "includes the expected issue" do
            issues = subject.issues
            expect(issues).to include an_object_having_attributes(
              kind:        Agama::Storage::IssueClasses::Config::MISUSED_PV,
              description: /.*sda.*cannot be formatted.*physical volume of.* volume group .*data/
            )
          end
        end
      end
    end

    context "if the device is found" do
      let(:search) { "/dev/vda" }

      it "does not include an issue" do
        expect(subject.issues.size).to eq(0)
      end
    end
  end
end

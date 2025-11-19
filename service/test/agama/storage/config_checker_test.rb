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

require_relative "./config_context"
require "agama/storage/config_checker"

describe Agama::Storage::ConfigChecker do
  include_context "config"

  subject { described_class.new(config, product_config) }

  let(:config_json) do
    {
      boot:         boot,
      drives:       drives,
      mdRaids:      md_raids,
      volumeGroups: volume_groups
    }
  end

  let(:boot) { nil }
  let(:drives) { nil }
  let(:md_raids) { nil }
  let(:volume_groups) { nil }

  describe "#issues" do
    context "if the boot config is not valid" do
      let(:boot) do
        {
          configure: true,
          alias:     nil
        }
      end

      it "includes the boot issues" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        :no_root,
          description: "The boot device cannot be automatically selected"
        )
      end
    end

    context "if a drive config is not valid" do
      let(:drives) do
        [
          {
            search: {
              condition:  { name: "/dev/vda" },
              ifNotFound: "error"
            }
          }
        ]
      end

      it "includes the drive issues" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        :search,
          description: "Mandatory device /dev/vda not found"
        )
      end
    end

    context "if a partition config from a drive is not valid" do
      let(:drives) do
        [
          {
            partitions: [
              { filesystem: { path: "/" } }
            ]
          }
        ]
      end

      it "includes the partition issues" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        :filesystem,
          description: "Missing file system type for '/'"
        )
      end
    end

    context "if a MD RAID config is not valid" do
      let(:md_raids) do
        [
          { devices: ["disk1"] }
        ]
      end

      it "includes the MD RAID issues" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        :no_such_alias,
          description: /no MD RAID member device with alias 'disk1'/
        )
      end
    end

    context "if a partition config from a MD RAID is not valid" do
      let(:md_raids) do
        [
          {
            partitions: [
              { filesystem: { path: "/" } }
            ]
          }
        ]
      end

      it "includes the partition issues" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        :filesystem,
          description: "Missing file system type for '/'"
        )
      end
    end

    context "if a volume group config is not valid" do
      let(:volume_groups) do
        [
          { name: nil }
        ]
      end

      it "includes the volume group issues" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          description: /without name/
        )
      end
    end

    context "if a logical volume config is not valid" do
      let(:volume_groups) do
        [
          {
            logicalVolumes: [
              { filesystem: { path: "/" } }
            ]
          }
        ]
      end

      it "includes the logical volume issues" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        :filesystem,
          description: "Missing file system type for '/'"
        )
      end
    end

    context "if some mount paths are required" do
      let(:volumes) { ["/", "swap"] }

      let(:volume_templates) do
        [
          {
            "mount_path" => "/",
            "filesystem" => "btrfs",
            "outline"    => { "required" => true }
          },
          {
            "mount_path" => "swap",
            "filesystem" => "swap",
            "outline"    => { "required" => true }
          }
        ]
      end

      context "and one of them is omitted at the configuration" do
        let(:drives) do
          [
            {
              partitions: [
                { filesystem: { path: "swap" } }
              ]
            }
          ]
        end

        it "includes an issue for the missing mount path" do
          issues = subject.issues
          expect(issues).to include an_object_having_attributes(
            kind:        :required_filesystems,
            description: /file system for \/ is/
          )
        end

        it "does not include an issue for the present mount path" do
          issues = subject.issues
          expect(issues).to_not include an_object_having_attributes(
            kind:        :required_filesystems,
            description: /file system for swap/
          )
        end
      end
    end

    context "if there are overused physical volumes devices" do
      let(:config_json) do
        {
          boot:         { configure: false },
          drives:       [
            { alias: "disk1" },
            { alias: "disk2" },
            { alias: "disk3" }
          ],
          volumeGroups: [
            {
              name:            "test1",
              physicalVolumes: [
                {
                  generate: {
                    targetDevices: ["disk1", "disk2"]
                  }
                }
              ]
            },
            {
              name:            "test2",
              physicalVolumes: [
                {
                  generate: {
                    targetDevices: ["disk2"]
                  }
                }
              ]
            },
            {
              name:            "test3",
              physicalVolumes: [
                {
                  generate: {
                    targetDevices: ["disk1", "disk3", "disk3"]
                  }
                }
              ]
            }
          ]
        }
      end

      it "includes the expected issues" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        :vg_target_devices,
          description: /The device 'disk1' is used several times/
        )
      end
    end

    context "if the config has several issues" do
      let(:config_json) do
        {
          boot:         { configure: false },
          drives:       [
            {
              search:     "/dev/vdd",
              encryption: { luks2: {} }
            }
          ],
          volumeGroups: [
            {
              name:            "test",
              physicalVolumes: ["pv1"]
            }
          ]
        }
      end

      it "includes the expected issues" do
        expect(subject.issues).to contain_exactly(
          an_object_having_attributes(
            description: match("Mandatory device /dev/vdd not found")
          ),
          an_object_having_attributes(
            description: match(/No passphrase provided/)
          ),
          an_object_having_attributes(
            description: match(/There is no LVM physical volume with alias 'pv1'/)
          )
        )
      end
    end

    context "if the config is valid" do
      let(:config_json) do
        {
          boot:         { configure: false },
          drives:       [
            { alias: "vda" },
            { alias: "vdb" }
          ],
          mdRaids:      [
            {
              level:   "raid0",
              devices: ["vda", "vdb"]
            }
          ],
          volumeGroups: [
            {
              name: "test"
            }
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

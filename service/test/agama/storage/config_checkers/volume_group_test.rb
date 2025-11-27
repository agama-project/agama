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
require "agama/storage/config_checkers/volume_group"

describe Agama::Storage::ConfigCheckers::VolumeGroup do
  include_context "config"

  subject { described_class.new(vg_config, config, product_config) }

  let(:config_json) do
    {
      drives:       [
        { alias: "first-disk" }
      ],
      volumeGroups: [
        {
          name:            name,
          physicalVolumes: physical_volumes
        }
      ]
    }
  end

  let(:name) { nil }
  let(:physical_volumes) { nil }

  let(:vg_config) { config.volume_groups.first }

  describe "#issues" do
    context "if the volume group has no name" do
      let(:name) { nil }

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          description: /without name/
        )
      end
    end

    context "if the volume group has an unknown physical volume" do
      let(:physical_volumes) { ["first-disk", "pv1"] }

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::ALIAS,
          description: /no LVM physical volume with alias 'pv1'/
        )
      end
    end

    context "if the volume group has an unknown target device for physical volumes" do
      let(:physical_volumes) do
        [
          {
            generate: {
              targetDevices: ["first-disk", "second-disk"]
            }
          }
        ]
      end

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::ALIAS,
          description: /no target device for LVM physical volumes with alias 'second-disk'/
        )
      end
    end

    context "if the volume group has encryption for physical volumes" do
      let(:physical_volumes) do
        [
          {
            generate: {
              targetDevices: ["first-disk"],
              encryption:    encryption
            }
          }
        ]
      end

      context "without password" do
        let(:encryption) do
          { luks1: {} }
        end

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues).to include an_object_having_attributes(
            kind:        Agama::Storage::IssueClasses::Config::ENCRYPTION,
            description: /No passphrase/
          )
        end
      end

      context "with unavailable method" do
        let(:encryption) do
          {
            luks2: {
              password: "12345"
            }
          }
        end

        before do
          allow_any_instance_of(Y2Storage::EncryptionMethod::Luks2)
            .to(receive(:available?))
            .and_return(false)
        end

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues).to include an_object_having_attributes(
            kind:        Agama::Storage::IssueClasses::Config::ENCRYPTION,
            description: /'Regular LUKS2' is not available/
          )
        end
      end

      context "with invalid method" do
        let(:encryption) { "random_swap" }

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues).to include an_object_having_attributes(
            kind:        Agama::Storage::IssueClasses::Config::ENCRYPTION,
            description: /'Encryption with Volatile Random Key' is not a suitable method/
          )
        end
      end

      context "with a valid encryption" do
        let(:encryption) do
          {
            luks1: {
              password: "12345"
            }
          }
        end

        it "does not include an encryption issue" do
          issues = subject.issues
          expect(issues).to_not include an_object_having_attributes(
            kind: Agama::Storage::IssueClasses::Config::ENCRYPTION
          )
        end
      end
    end

    context "if the volume group has several target devices for physical volumes" do
      let(:scenario) { "disks.yaml" }

      let(:config_json) do
        {
          drives:       [
            {
              alias:  "vda",
              search: "/dev/vda"
            },
            {
              alias:  "vdb",
              search: "/dev/vdb"
            }
          ],
          mdRaids:      [
            {
              alias:  "md1",
              search: {
                condition:  { name: "/dev/md1" },
                ifNotFound: "error"
              }
            },
            {
              alias:  "md2",
              search: {
                condition:  { name: "/dev/md2" },
                ifNotFound: "create"
              }
            },
            { alias: "md3" }
          ],
          volumeGroups: [
            {
              name:            "system",
              physicalVolumes: [
                { generate: target_devices }
              ]
            }
          ]
        }
      end

      before { solve_config }

      context "and mixes new and reused devices" do
        let(:target_devices) { ["vda", "md2"] }

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues).to include an_object_having_attributes(
            kind:        Agama::Storage::IssueClasses::Config::LVM,
            description: /'system' is mixing reused devices and new devices/
          )
        end
      end

      context "and all the devices are new" do
        let(:target_devices) { ["md2", "md3"] }

        it "does not include an incompatible targets issue" do
          issues = subject.issues
          expect(issues).to_not include an_object_having_attributes(
            kind: Agama::Storage::IssueClasses::Config::LVM
          )
        end
      end

      context "and all the devices are reused" do
        let(:target_devices) { ["vda", "vdb", "md1"] }

        it "does not include an incompatible targets issue" do
          issues = subject.issues
          expect(issues).to_not include an_object_having_attributes(
            kind: Agama::Storage::IssueClasses::Config::LVM
          )
        end
      end
    end

    context "if the volume group is valid" do
      let(:name) { "vg0" }

      let(:physical_volumes) { ["first-disk"] }

      before { solve_config }

      it "does not report issues" do
        expect(subject.issues).to eq([])
      end
    end
  end
end

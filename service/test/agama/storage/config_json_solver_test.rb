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

require_relative "../../test_helper"
require "agama/storage/config_json_solver"

describe Agama::Storage::ConfigJSONSolver do
  subject do
    described_class.new(default_paths: default_paths, mandatory_paths: mandatory_paths)
  end

  let(:default_paths) { [] }
  let(:mandatory_paths) { [] }

  describe "#solve" do
    shared_examples "generate" do |devices_key, volumes_key|
      let(:default_paths) { ["/", "swap", "/home"] }
      let(:mandatory_paths) { ["/", "swap"] }

      let(:config_json) do
        { devices_key => devices }
      end

      context "if '#{volumes_key}' contains a config with 'generate'" do
        let(:devices) do
          [
            {
              volumes_key => [
                { generate: generate }
              ]
            }
          ]
        end

        context "with 'default' value" do
          let(:generate) { "default" }

          it "adds '#{volumes_key}' for the default paths" do
            subject.solve(config_json)
            volumes_json = config_json[devices_key][0][volumes_key]

            expect(volumes_json).to contain_exactly(
              { filesystem: { path: "/" } },
              { filesystem: { path: "swap" } },
              { filesystem: { path: "/home" } }
            )
          end
        end

        context "with 'mandatory' value" do
          let(:generate) { "mandatory" }

          it "adds '#{volumes_key}' for the mandatory paths" do
            subject.solve(config_json)
            volumes_json = config_json[devices_key][0][volumes_key]

            expect(volumes_json).to contain_exactly(
              { filesystem: { path: "/" } },
              { filesystem: { path: "swap" } }
            )
          end
        end

        context "with a 'generate' section" do
          let(:generate) do
            {
              volumes_key => "mandatory",
              encryption: {
                luks2: { password: "12345" }
              }
            }
          end

          it "adds '#{volumes_key}' with the specified properties" do
            subject.solve(config_json)
            volumes_json = config_json[devices_key][0][volumes_key]

            expect(volumes_json).to contain_exactly(
              {
                filesystem: { path: "/" },
                encryption: {
                  luks2: { password: "12345" }
                }
              },
              {
                filesystem: { path: "swap" },
                encryption: {
                  luks2: { password: "12345" }
                }
              }
            )
          end
        end
      end

      context "if '#{volumes_key}' contains several configs with 'generate'" do
        let(:devices) do
          [
            {
              volumes_key => [
                { generate: "mandatory" },
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds '#{volumes_key}' for the first 'generate'" do
          subject.solve(config_json)
          volumes_json = config_json[devices_key][0][volumes_key]

          expect(volumes_json).to contain_exactly(
            { filesystem: { path: "/" } },
            { filesystem: { path: "swap" } }
          )
        end
      end

      context "if several '#{devices_key}' contain '#{volumes_key}' with 'generate'" do
        let(:devices) do
          [
            {
              volumes_key => [
                { generate: "mandatory" }
              ]
            },
            {
              volumes_key => [
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds '#{volumes_key}' to the first '#{devices_key}' with a 'generate'" do
          subject.solve(config_json)
          devices_json = config_json[devices_key]

          expect(devices_json).to contain_exactly(
            {
              volumes_key => [
                { filesystem: { path: "/" } },
                { filesystem: { path: "swap" } }
              ]
            },
            {
              volumes_key => []
            }
          )
        end
      end

      context "if '#{volumes_key}' already contains a config for any of the paths" do
        let(:devices) do
          [
            {
              volumes_key => [
                { generate: "default" },
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds '#{volumes_key}' for the the missing paths" do
          subject.solve(config_json)
          volumes_json = config_json[devices_key][0][volumes_key]

          expect(volumes_json).to contain_exactly(
            { filesystem: { path: "/" } },
            { filesystem: { path: "swap" } },
            { filesystem: { path: "/home" } }
          )
        end
      end

      context "if other '#{devices_key}' config already contains any of the paths" do
        let(:devices) do
          [
            {
              volumes_key => [
                { generate: "default" }
              ]
            },
            {
              volumes_key => [
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds '#{volumes_key}' for the the missing paths" do
          subject.solve(config_json)
          devices_json = config_json[devices_key]

          expect(devices_json).to contain_exactly(
            {
              volumes_key => [
                { filesystem: { path: "/" } },
                { filesystem: { path: "swap" } }
              ]
            },
            {
              volumes_key => [
                { filesystem: { path: "/home" } }
              ]
            }
          )
        end
      end
    end

    shared_examples "generate missing" do
      |devices_key, volumes_key, other_devices_key, other_volumes_key|
      let(:default_paths) { ["/", "swap", "/home"] }
      let(:mandatory_paths) { ["/", "swap"] }

      context "if a '#{other_devices_key}' config already specifies any of the paths" do
        let(:config_json) do
          {
            devices_key       => [
              {
                volumes_key => [
                  { generate: "default" }
                ]
              }
            ],
            other_devices_key => [
              {
                other_volumes_key => [
                  { filesystem: { path: "swap" } }
                ]
              }
            ]
          }
        end

        it "only adds '#{volumes_key}' for the the missing paths" do
          subject.solve(config_json)
          volumes_json = config_json[devices_key][0][volumes_key]

          expect(volumes_json).to contain_exactly(
            { filesystem: { path: "/" } },
            { filesystem: { path: "/home" } }
          )
        end
      end
    end

    context "if a drive generates partitions" do
      include_examples "generate", :drives, :partitions
      include_examples "generate missing", :drives, :partitions, :volumeGroups, :logicalVolumes
      include_examples "generate missing", :drives, :partitions, :mdRaids, :partitions
    end

    context "if a MD RAID generates partitions" do
      include_examples "generate", :mdRaids, :partitions
      include_examples "generate missing", :mdRaids, :partitions, :volumeGroups, :logicalVolumes
      include_examples "generate missing", :mdRaids, :partitions, :drives, :partitions
    end

    context "if a volume group generates logical volumes" do
      shared_examples "do not generate logical volumes" do |devices_key, volumes_key|
        let(:default_paths) { ["/", "swap", "/home"] }
        let(:mandatory_paths) { ["/", "swap"] }

        context "if a '#{devices_key}' config specifies a 'generate'" do
          let(:config_json) do
            {
              devices_key =>     [
                {
                  volumes_key => [
                    { generate: "mandatory" }
                  ]
                }
              ],
              volumeGroups: [
                {
                  logicalVolumes: [
                    { generate: "mandatory" }
                  ]
                }
              ]
            }
          end

          it "does not add 'logicalVolumes'" do
            subject.solve(config_json)
            logical_volumes_json = config_json[:volumeGroups][0][:logicalVolumes]

            expect(logical_volumes_json).to eq([])
          end
        end
      end

      include_examples "generate", :volumeGroups, :logicalVolumes
      include_examples "generate missing", :volumeGroups, :logicalVolumes, :drives, :partitions
      include_examples "generate missing", :volumeGroups, :logicalVolumes, :mdRaids, :partitions
      include_examples "do not generate logical volumes", :drives, :partitions
      include_examples "do not generate logical volumes", :mdRaids, :partitions
    end
  end
end

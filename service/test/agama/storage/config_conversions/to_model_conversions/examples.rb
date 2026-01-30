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

require "y2storage/blk_device"
require "y2storage/refinements"
require "agama/config"

using Y2Storage::Refinements::SizeCasts

shared_examples "without filesystem" do
  context "if #filesystem is not configured" do
    let(:filesystem) { nil }

    it "generates the expected JSON" do
      model_json = subject.convert
      expect(model_json.keys).to_not include(:mountPath)
      expect(model_json.keys).to_not include(:filesystem)
    end
  end
end

shared_examples "without size" do
  context "if #size is not configured" do
    let(:size) { nil }

    it "generates the expected JSON" do
      model_json = subject.convert
      expect(model_json[:size]).to eq(
        {
          default: true,
          min:     0
        }
      )
    end
  end
end

shared_examples "without ptable_type" do
  context "if #ptable_type is not configured" do
    let(:ptable_type) { nil }

    it "generates the expected JSON" do
      model_json = subject.convert
      expect(model_json.keys).to_not include(:ptableType)
    end
  end
end

shared_examples "without partitions" do
  context "if #partitions is not configured" do
    let(:partitions) { nil }

    it "generates the expected JSON" do
      model_json = subject.convert
      expect(model_json[:spacePolicy]).to eq("keep")
      expect(model_json[:partitions]).to eq([])
    end
  end
end

shared_examples "with filesystem" do
  context "if #filesystem is configured" do
    let(:filesystem) do
      {
        reuseIfPossible: true,
        type:            "xfs",
        label:           "test",
        path:            "/test",
        mountBy:         "device",
        mkfsOptions:     ["version=2"],
        mountOptions:    ["rw"]
      }
    end

    it "generates the expected JSON" do
      model_json = subject.convert
      expect(model_json[:mountPath]).to eq("/test")
      expect(model_json[:filesystem]).to eq(
        {
          reuse:   true,
          default: false,
          type:    "xfs",
          label:   "test"
        }
      )
    end
  end

  context "if btrfs with snapshots is configured" do
    let(:filesystem) do
      {
        type:  {
          btrfs: {
            snapshots: true
          }
        },
        label: "test",
        path:  "/"
      }
    end

    it "generates the expected JSON" do
      model_json = subject.convert
      expect(model_json[:mountPath]).to eq("/")
      expect(model_json[:filesystem]).to eq(
        {
          reuse:   false,
          default: false,
          type:    "btrfsSnapshots",
          label:   "test"
        }
      )
    end
  end

  context "if btrfs with no snapshots is configured" do
    let(:filesystem) do
      {
        type:  "btrfs",
        label: "test",
        path:  "/"
      }
    end

    it "generates the expected JSON" do
      model_json = subject.convert
      expect(model_json[:mountPath]).to eq("/")
      expect(model_json[:filesystem]).to eq(
        {
          reuse:   false,
          default: false,
          type:    "btrfs",
          label:   "test"
        }
      )
    end

    context "if the root product volume is configured as read-only" do
      let(:volumes) { Agama::Storage::VolumeTemplatesBuilder.new_from_config(product_config) }
      let(:product_config) { Agama::Config.new(product_config_data) }
      let(:product_config_data) { { "storage" => { "volume_templates" => [root_template] } } }
      let(:root_template) do
        {
          "mount_path" => "/", "filesystem" => "btrfs",
          "btrfs" => { "read_only" => true, "snapshots" => true }
        }
      end

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:mountPath]).to eq("/")
        expect(model_json[:filesystem]).to eq(
          {
            reuse:   false,
            default: false,
            type:    "btrfsImmutable",
            label:   "test"
          }
        )
      end
    end
  end
end

shared_examples "with size" do
  context "if #size is configured" do
    let(:size) { { min: "1 GiB", max: "2 GiB" } }

    it "generates the expected JSON" do
      model_json = subject.convert
      expect(model_json[:size]).to eq(
        {
          default: false,
          min:     1.GiB.to_i,
          max:     2.GiB.to_i
        }
      )
    end
  end
end

shared_examples "with ptable_type" do
  context "if #ptable_type is configured" do
    let(:ptable_type) { "gpt" }

    it "generates the expected JSON" do
      model_json = subject.convert
      expect(model_json[:ptableType]).to eq("gpt")
    end
  end
end

shared_examples "with partitions" do
  context "if #partitions is configured" do
    let(:partitions) do
      [
        { size: "10 GiB" },
        { filesystem: { path: "/" } }
      ]
    end

    it "generates the expected JSON" do
      model_json = subject.convert
      expect(model_json[:partitions]).to eq(
        [
          {
            delete:         false,
            deleteIfNeeded: false,
            resize:         false,
            resizeIfNeeded: false,
            size:           {
              default: false,
              min:     10.GiB.to_i,
              max:     10.GiB.to_i
            }
          },
          {
            delete:         false,
            deleteIfNeeded: false,
            resize:         false,
            resizeIfNeeded: false,
            filesystem:     {
              reuse: false
            },
            mountPath:      "/",
            size:           {
              default: true,
              min:     0
            }
          }
        ]
      )
    end
  end
end

shared_examples "device name" do
  context "for the 'name' property" do
    context "if #search is not configured" do
      let(:search) { nil }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json.keys).to_not include(:name)
      end
    end

    context "if #search is configured" do
      let(:search) do
        {
          condition:  condition,
          ifNotFound: if_not_found
        }
      end

      let(:condition) { nil }
      let(:if_not_found) { nil }

      context "and the device is searched by name" do
        let(:condition) { { name: "/dev/test" } }

        context "if the device is not found" do
          before { config.search.solve }

          context "and the device does not have to be created" do
            let(:if_not_found) { "error" }

            it "generates the expected JSON" do
              model_json = subject.convert
              expect(model_json[:name]).to eq("/dev/test")
            end
          end

          context "and the device has to be created" do
            let(:if_not_found) { "create" }

            it "generates the expected JSON" do
              model_json = subject.convert
              expect(model_json.keys).to_not include(:name)
            end
          end
        end

        context "if the device is found" do
          before { config.search.solve(device) }

          let(:device) { instance_double(Y2Storage::BlkDevice, name: "/dev/test") }

          it "generates the expected JSON" do
            model_json = subject.convert
            expect(model_json[:name]).to eq("/dev/test")
          end
        end
      end

      context "and the device is not searched by name" do
        let(:condition) { nil }

        context "if the device is not found" do
          before { config.search.solve }

          context "and the device does not have to be created" do
            let(:if_not_found) { "error" }

            it "generates the expected JSON" do
              model_json = subject.convert
              expect(model_json.keys).to_not include(:name)
            end
          end

          context "and the device has to be created" do
            let(:if_not_found) { "create" }

            it "generates the expected JSON" do
              model_json = subject.convert
              expect(model_json.keys).to_not include(:name)
            end
          end
        end

        context "if the device is found" do
          before { config.search.solve(device) }

          let(:device) { instance_double(Y2Storage::BlkDevice, name: "/dev/test") }

          it "generates the expected JSON" do
            model_json = subject.convert
            expect(model_json[:name]).to eq("/dev/test")
          end
        end
      end
    end
  end
end

shared_examples "space policy" do
  context "for the 'spacePolicy' property" do
    let(:device) { instance_double(Y2Storage::BlkDevice, name: "/dev/test") }

    context "if there is a 'delete all' partition" do
      let(:partitions) do
        [
          { search: "*", delete: true },
          { size: "2 GiB" }
        ]
      end

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:spacePolicy]).to eq("delete")
      end
    end

    context "if there is a 'resize all' partition" do
      let(:partitions) do
        [
          { search: "*", size: { min: 0, max: "current" } },
          { size: "2 GiB" }
        ]
      end

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:spacePolicy]).to eq("resize")
      end
    end

    context "if there is a 'delete' partition" do
      let(:partitions) do
        [
          { search: { max: 1 }, delete: true },
          { filesystem: { path: "/" } }
        ]
      end

      before { config.partitions.first.search.solve(device) }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:spacePolicy]).to eq("custom")
      end
    end

    context "if there is a 'delete if needed' partition" do
      let(:partitions) do
        [
          { search: { max: 1 }, deleteIfNeeded: true },
          { filesystem: { path: "/" } }
        ]
      end

      before { config.partitions.first.search.solve(device) }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:spacePolicy]).to eq("custom")
      end
    end

    context "if there is a 'resize' partition" do
      let(:partitions) do
        [
          { search: { max: 1 }, size: "1 GiB" },
          { filesystem: { path: "/" } }
        ]
      end

      before { config.partitions.first.search.solve(device) }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:spacePolicy]).to eq("custom")
      end
    end

    context "if there is a 'resize if needed' partition" do
      let(:partitions) do
        [
          { search: { max: 1 }, size: { min: 0, max: "1 GiB" } },
          { filesystem: { path: "/" } }
        ]
      end

      before { config.partitions.first.search.solve(device) }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:spacePolicy]).to eq("custom")
      end
    end

    context "if there is neither 'delete' nor 'resize' partition" do
      let(:partitions) do
        [
          { size: { min: "1 GiB" } },
          { filesystem: { path: "/" } }
        ]
      end

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:spacePolicy]).to eq("keep")
      end
    end
  end
end

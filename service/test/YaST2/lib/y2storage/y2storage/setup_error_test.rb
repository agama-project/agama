#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018] SUSE LLC
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"
require "y2storage"
require "y2storage/setup_error"

describe Y2Storage::SetupError do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject { described_class.new(message: error_message, missing_volume: missing_volume) }

  let(:error_message) { nil }

  let(:missing_volume) { nil }

  let(:volume) do
    volume = Y2Storage::VolumeSpecification.new({})
    volume.mount_point = mount_point
    volume.min_size = min_size
    volume.fs_types = fs_types
    volume.partition_id = partition_id
    volume
  end

  let(:mount_point) { nil }
  let(:min_size) { Y2Storage::DiskSize.zero }
  let(:fs_types) { [] }
  let(:partition_id) { nil }

  describe "#message" do
    context "when an error message is given" do
      let(:error_message) { "an error message" }

      context "and a missing volume is not given" do
        let(:missing_volume) { nil }

        it "returns the given message" do
          expect(subject.message).to eq(error_message)
        end
      end

      context "and a missing volume is given" do
        let(:missing_volume) { volume }

        it "returns the given message" do
          expect(subject.message).to eq(error_message)
        end
      end
    end

    context "when an error message is not given" do
      let(:error_message) { nil }

      context "and a missing volume is not given" do
        it "returns nil" do
          expect(subject.message).to be_nil
        end
      end

      context "and a missing volume is given" do
        let(:missing_volume) { volume }

        context "when the volume has a mount point" do
          let(:mount_point) { "/mnt/foo" }

          it "generates an error message with mount point data" do
            expect(subject.message).to match(/device for \/.* /)
          end

          context "and the volume has a partition id and fs type" do
            let(:partition_id) { Y2Storage::PartitionId::LINUX }

            let(:fs_types) { [Y2Storage::Filesystems::Type::EXT3] }

            it "generates an error message with partition id and fs type data" do
              expect(subject.message).to match(/partition id .*/)
              expect(subject.message).to match(/filesystem .*/)
            end
          end

          context "and the volume has a partition id but does not have fs type" do
            let(:partition_id) { Y2Storage::PartitionId::LINUX }

            let(:fs_types) { [] }

            it "generates an error message with partition id but not fs type data" do
              expect(subject.message).to match(/partition id .*/)
              expect(subject.message).to_not match(/filesystem .*/)
            end
          end

          context "and the volume does not have a partition id but has a fs type" do
            let(:partition_id) { nil }

            let(:fs_types) { [Y2Storage::Filesystems::Type::EXT3] }

            it "generates an error message without partition id but with fs type data" do
              expect(subject.message).to_not match(/partition id .*/)
              expect(subject.message).to match(/filesystem .*/)
            end
          end

          context "and the volume does not have neither partition id nor fs type" do
            let(:partition_id) { nil }

            let(:fs_types) { [] }

            it "generates a message without partition id neither fs type data" do
              expect(subject.message).to_not match(/partition id .*/)
              expect(subject.message).to_not match(/filesystem .*/)
            end
          end
        end

        context "when the volume does not have a mount point" do
          let(:mount_point) { nil }

          it "generates an error messagge without mount point data" do
            expect(subject.message).to_not match(/\/.* /)
          end

          context "and the volume has a partition id and fs type" do
            let(:partition_id) { Y2Storage::PartitionId::LINUX }

            let(:fs_types) { [Y2Storage::Filesystems::Type::EXT3] }

            it "generates an error message with partition id and fs type data" do
              expect(subject.message).to match(/partition id .*/)
              expect(subject.message).to match(/filesystem .*/)
            end
          end

          context "and the volume has a partition id but does not have fs type" do
            let(:partition_id) { Y2Storage::PartitionId::LINUX }

            let(:fs_types) { [] }

            it "generates an error message with partition id but not fs type data" do
              expect(subject.message).to match(/partition id .*/)
              expect(subject.message).to_not match(/filesystem .*/)
            end
          end

          context "and the volume does not have a partition id but has a fs type" do
            let(:partition_id) { nil }

            let(:fs_types) { [Y2Storage::Filesystems::Type::EXT3] }

            it "generates an error message without partition id but with fs type data" do
              expect(subject.message).to_not match(/partition id .*/)
              expect(subject.message).to match(/filesystem .*/)
            end
          end

          context "and the volume does not have neither partition id nor fs type" do
            let(:partition_id) { nil }

            let(:fs_types) { [] }

            it "generates a message without partition id neither fs type data" do
              expect(subject.message).to_not match(/partition id .*/)
              expect(subject.message).to_not match(/filesystem .*/)
            end
          end
        end
      end
    end
  end
end

# frozen_string_literal: true

# Vendored from yast2-bootloader's test/device_path_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/device_path"

describe Bootloader::DevicePath do
  include_context "yast2-bootloader test setup"

  subject(:dev_path) { Bootloader::DevicePath.new(param) }
  let(:storage_manager) { double(Y2Storage::StorageManager, system: device_graph) }

  context "When activated with path for device file" do
    let(:param) { "/dev/sda1" }

    it "Stores the path as obtained" do
      expect(dev_path.path).to eql param
    end

    describe "#exists?" do
      context "when the path exists" do
        let(:device_graph) do
          double(Y2Storage::Devicegraph, find_by_any_name: double(Y2Storage::Device))
        end

        it "succeedes" do
          allow(Y2Storage::StorageManager)
            .to receive(:instance)
            .and_return(storage_manager)

          expect(dev_path.exists?).to be true
        end
      end

      context "when the path doesn't exist" do
        let(:device_graph) do
          double(Y2Storage::Devicegraph, find_by_any_name: nil)
        end

        it "fails" do
          allow(Y2Storage::StorageManager)
            .to receive(:instance)
            .and_return(storage_manager)

          expect(Bootloader::DevicePath.new("/nonsense").exists?).to be false
        end
      end
    end

    describe "#uuid?" do
      it "fails for real device path" do
        expect(dev_path.uuid?).to be false
      end
    end

    describe "#label?" do
      it "fails for real device path" do
        expect(dev_path.label?).to be false
      end
    end
  end

  context "When activated with UUID" do
    let(:uuid) { "00000000-1111-2222-3333-444444444444" }
    let(:param) { "UUID=\"#{uuid}\"" }
    let(:fs_path) { "/dev/disk/by-uuid/#{uuid}" }

    it "Converts UUID to fs path" do
      expect(dev_path.path).to eql fs_path
    end

    describe "#exists?" do
      context "when the path exists" do
        let(:device_graph) do
          double(Y2Storage::Devicegraph, find_by_any_name: double(Y2Storage::Device))
        end

        it "succeedes" do
          allow(Y2Storage::StorageManager)
            .to receive(:instance)
            .and_return(storage_manager)

          expect(dev_path.exists?).to be true
        end
      end
    end

    describe "#uuid?" do
      it "succeedes" do
        expect(dev_path.uuid?).to be true
      end
    end

    describe "#label?" do
      it "fails for uuid activated path" do
        expect(dev_path.label?).to be false
      end
    end
  end

  context "When activated with LABEL" do
    let(:label) { "OpenSUSE" }
    let(:param) { "LABEL=\"#{label}\"" }
    let(:fs_path) { "/dev/disk/by-label/#{label}" }

    it "Converts LABEL to fs path" do
      expect(dev_path.path).to eql fs_path
    end

    describe "#exists?" do
      context "when the path exists" do
        let(:device_graph) do
          double(Y2Storage::Devicegraph, find_by_any_name: double(Y2Storage::Device))
        end

        it "succeedes for existing device" do
          allow(Y2Storage::StorageManager)
            .to receive(:instance)
            .and_return(storage_manager)

          expect(dev_path.exists?).to be true
        end
      end
    end

    describe "#uuid?" do
      it "fails for label activated path" do
        expect(dev_path.uuid?).to be false
      end
    end

    describe "#label?" do
      it "succeedes" do
        expect(dev_path.label?).to be true
      end
    end
  end
end

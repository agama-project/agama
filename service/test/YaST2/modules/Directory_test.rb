#! /usr/bin/env rspec

require_relative "test_helper"

Yast.import "Directory"

describe Yast::Directory do
  describe ".find_data_file" do
    subject(:file_path) { Yast::Directory.find_data_file(file) }

    context "when file does not exist" do
      let(:file) { "does_not_exist.txt" }

      it "returns nil" do
        expect(file_path).to be_nil
      end
    end

    context "when the file is present" do
      let(:file) { "data_file.txt" }

      it "returns the full path" do
        expect(File.read(file_path)).to eq "Data file content"
      end
    end
  end
end

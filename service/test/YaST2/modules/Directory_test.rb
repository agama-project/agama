# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

Yast.import "Directory"

describe Yast::Directory do
  describe ".find_data_file" do
    subject(:file_path) { Yast::Directory.find_data_file(file) }

    before do
      allow(Yast).to receive(:y2paths).and_return(["#{FIXTURES_PATH}/yast2/general"])
    end

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

# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require_relative File.join(
  SRC_PATH, "agama", "dbus", "y2dir", "modules", "Autologin.rb"
)

describe Yast::Autologin do
  subject { Yast::Autologin }

  before do
    subject.main
    allow(Agama::HTTP::Clients::Software).to receive(:new).and_return(client)
  end

  let(:client) do
    instance_double(Agama::HTTP::Clients::Software)
  end

  describe "#supported?" do
    before do
      allow(client).to receive(:provisions_selected?).with(Array)
        .and_return(provisions_selected?)
    end

    context "when some display manager is selected" do
      let(:provisions_selected?) { [true, false] }

      xit "returns true" do
        expect(subject.supported?).to eq(true)
      end
    end

    context "when no display managers are selected" do
      let(:provisions_selected?) { [false, false] }

      it "returns false" do
        expect(subject.supported?).to eq(false)
      end
    end
  end
end

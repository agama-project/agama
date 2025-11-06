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
require "yast"
require "agama/autoyast/services_manager_reader"

Yast.import "Profile"

describe Agama::AutoYaST::ServicesManagerReader do
  let(:profile) { {} }

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  describe "#read" do
    context "when there is no services-manager section" do
      let(:profile) { {} }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when profile enables a service" do
      let(:profile) do
        {
          "services-manager" => {
            "default_target" => "multi-user",
            "services"       => {
              "enable" => ["service"]
            }
          }
        }
      end

      it "defines appropriate post script" do
        result = subject.read

        expect(result).not_to be_empty
        expect(result.first["content"]).to match(/service/)
        expect(result.first["content"]).to match(/set-default multi-user/)
      end
    end
  end
end

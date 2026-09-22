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

require_relative "../../../test_helper"
require "agama/y2dir/modules/Package"
require "agama/config"
require "agama/storage/manager"

describe Yast::PackageClass do
  subject(:package) { Yast::Package }

  describe "#Available" do
    context "when checking for os-prober package" do
      let(:storage) { instance_double(Agama::Storage::Manager, product_config: product_config) }
      let(:product_config) do
        instance_double(
          Agama::Config,
          mandatory_packages: mandatory_packages,
          optional_packages:  optional_packages
        )
      end
      let(:mandatory_packages) { [] }
      let(:optional_packages) { [] }

      before do
        package.storage = storage
      end

      context "when the product requires os-prober in mandatory packages" do
        let(:mandatory_packages) { ["os-prober", "other-package"] }

        it "returns true" do
          expect(package.Available("os-prober")).to be(true)
        end
      end

      context "when the product requires os-prober in optional packages" do
        let(:optional_packages) { ["os-prober", "other-package"] }

        it "returns true" do
          expect(package.Available("os-prober")).to be(true)
        end
      end

      context "when the product requires os-prober in both mandatory and optional packages" do
        let(:mandatory_packages) { ["os-prober"] }
        let(:optional_packages) { ["os-prober"] }

        it "returns true" do
          expect(package.Available("os-prober")).to be(true)
        end
      end

      context "when the product does not require os-prober" do
        let(:mandatory_packages) { ["other-package"] }
        let(:optional_packages) { ["another-package"] }

        it "returns false" do
          expect(package.Available("os-prober")).to be(false)
        end
      end

      context "when storage is not set" do
        before do
          package.storage = nil
        end

        it "returns false" do
          expect(package.Available("os-prober")).to be(false)
        end
      end

      context "when storage does not have product_config" do
        let(:storage) { instance_double(Agama::Storage::Manager, product_config: nil) }

        it "returns false" do
          expect(package.Available("os-prober")).to be(false)
        end
      end

      context "when product_config does not have mandatory_packages" do
        let(:product_config) do
          instance_double(
            Agama::Config,
            mandatory_packages: nil,
            optional_packages:  []
          )
        end

        it "returns false" do
          expect(package.Available("os-prober")).to be(false)
        end
      end

      context "when product_config does not have optional_packages" do
        let(:product_config) do
          instance_double(
            Agama::Config,
            mandatory_packages: [],
            optional_packages:  nil
          )
        end

        it "returns false" do
          expect(package.Available("os-prober")).to be(false)
        end
      end
    end

    context "when checking for any other package" do
      it "returns true for random package names" do
        expect(package.Available("vim")).to be(true)
        expect(package.Available("emacs")).to be(true)
        expect(package.Available("some-random-package")).to be(true)
      end
    end
  end
end

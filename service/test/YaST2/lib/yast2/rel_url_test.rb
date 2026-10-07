require_relative "../test_helper"
require "yast2/rel_url"

describe Yast2::RelURL do
  describe ".is_relurl?" do
    it "raises ArgumentError for nil" do
      expect { Yast2::RelURL.relurl?(nil) }.to raise_error(ArgumentError)
    end

    it "raises ArgumentError for invalid parameter" do
      expect { Yast2::RelURL.relurl?(42) }.to raise_error(ArgumentError)
    end

    it "raises URI::InvalidURIError for invalid URL" do
      expect { Yast2::RelURL.relurl?("!@#$^") }.to raise_error(URI::InvalidURIError)
    end

    it "returns false for empty string" do
      expect(Yast2::RelURL.relurl?("")).to be false
    end

    it "returns false for HTTP String URL" do
      expect(Yast2::RelURL.relurl?("http://example.com")).to be false
    end

    it "returns false for HTTP URI URL" do
      expect(Yast2::RelURL.relurl?(URI("http://example.com"))).to be false
    end

    it "returns true for relative String URL" do
      expect(Yast2::RelURL.relurl?("relurl://test/test")).to be true
    end

    it "returns true for relative URI URL" do
      expect(Yast2::RelURL.relurl?(URI("relurl://test/test"))).to be true
    end

    it "returns true for upper case URL" do
      expect(Yast2::RelURL.relurl?("RELURL://test/test")).to be true
    end

    it "returns true for mixed case URL" do
      expect(Yast2::RelURL.relurl?("RELurl://test/test")).to be true
    end
  end

  describe "#initialize" do
    it "raises ArgumentError for invalid parameter" do
      expect { Yast2::RelURL.new(42, 42) }.to raise_error(ArgumentError)
    end

    it "raises URI::InvalidURIError for invalid URL" do
      expect { Yast2::RelURL.new("@#$%^&*", "@#$%^&*") }.to raise_error(URI::InvalidURIError)
    end
  end

  describe "#absolute_url" do
    # empty URLs should not be used, just make sure it does not crash
    # and returns sane values
    it "returns the base URL if the relative URL is empty" do
      relurl = Yast2::RelURL.new("http://example.com", "")
      expect(relurl.absolute_url.to_s).to eq("http://example.com")
    end

    it "returns the relative URL if the base URL is empty" do
      relurl = Yast2::RelURL.new("", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("relurl:/test")
    end

    it "relurl can have 1 slash (relurl:/)" do
      relurl = Yast2::RelURL.new("", "relurl:/test")
      expect(relurl.absolute_url.to_s).to eq("relurl:/test")
    end

    it "relurl can have 2 slashes (relurl://)" do
      relurl = Yast2::RelURL.new("", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("relurl:/test")
    end

    it "relurl can have 3 slashes (relurl:///)" do
      relurl = Yast2::RelURL.new("", "relurl:///test")
      expect(relurl.absolute_url.to_s).to eq("relurl:/test")
    end

    it "returns empty URL if both relative and base URLs are empty" do
      relurl = Yast2::RelURL.new("", "")
      expect(relurl.absolute_url.to_s).to eq("")
    end

    it "returns the original relative URL if it does not use the relurl:// schema" do
      relurl = Yast2::RelURL.new("http://example.com", "http://example2.com")
      expect(relurl.absolute_url.to_s).to eq("http://example2.com")
    end

    it "returns the relative URL" do
      relurl = Yast2::RelURL.new("http://example.com", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/test")
    end

    it "returns relative URL with full path" do
      relurl = Yast2::RelURL.new("http://example.com", "relurl://test/test2/test3")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/test/test2/test3")
    end

    it "returns relative URL with base path" do
      relurl = Yast2::RelURL.new("http://example.com/base", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/base/test")
    end

    it "treats the hostname in the relative URL as a path" do
      relurl = Yast2::RelURL.new("http://example.com/base", "relurl://example.com/test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/base/example.com/test")
    end

    it "treats absolute_url path as relative in the relative URL" do
      relurl = Yast2::RelURL.new("http://example.com/base", "relurl:///test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/base/test")
    end

    # this is rather a side effect of the used library function and not an intended
    # behavior, but as ~ is used very rarely in path names (needs shell escaping)
    # let's consider it as an acceptable behavior, the escaped character in URL is equal
    # to unescaped one so there is no functional difference, only visual
    it "escapes ~ character in the relative URL path" do
      relurl = Yast2::RelURL.new("http://example.com/~base", "relurl://~test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/~base/%7Etest")
    end

    it "allows going up in the tree using ../" do
      relurl = Yast2::RelURL.new("http://example.com/base/dir", "relurl://../test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/base/test")
    end

    it "allows going up in the tree using ../.." do
      relurl = Yast2::RelURL.new("http://example.com/base/dir", "relurl://../../test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/test")
    end

    it "cannot go up beyond the root dir" do
      relurl = Yast2::RelURL.new("http://example.com/base", "relurl://../../../../test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/test")
    end

    it "removes single dot item from relative path" do
      relurl = Yast2::RelURL.new("http://example.com/base", "relurl://./test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/base/test")
    end

    it "removes multiple dot items from relative path" do
      relurl = Yast2::RelURL.new("http://example.com/base", "relurl://././test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/base/test")
    end

    # again, this is rather a side effect of the used library, but as single dots
    # do not make much sense in a path then just accept that
    it "removes single dot path from base path" do
      relurl = Yast2::RelURL.new("http://example.com/base/./dir", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/base/dir/test")
    end

    # same as above
    it "removes single dot paths from base path" do
      relurl = Yast2::RelURL.new("http://example.com/base/././dir", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/base/dir/test")
    end

    it "ignores query parameters in the relative URL" do
      relurl = Yast2::RelURL.new("http://example.com", "relurl://test?foo=bar")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/test")
    end

    it "keeps the query parameters in the base URL" do
      relurl = Yast2::RelURL.new("http://example.com?foo=bar", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/test?foo=bar")
    end

    it "keeps the query parameters in the base URL when going up" do
      relurl = Yast2::RelURL.new("http://example.com/base/dir?foo=bar", "relurl://../test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com/base/test?foo=bar")
    end

    it "keeps the port parameter in the base URL" do
      relurl = Yast2::RelURL.new("http://example.com:8080", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("http://example.com:8080/test")
    end

    it "keeps the user and password parameters in the base URL" do
      relurl = Yast2::RelURL.new("http://user:password@example.com", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("http://user:password@example.com/test")
    end

    it "works with ftp:// URL" do
      relurl = Yast2::RelURL.new("ftp://example.com", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("ftp://example.com/test")
    end

    it "works with cd:/ URL" do
      relurl = Yast2::RelURL.new("cd:/", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("cd:/test")
    end

    it "corrects cd:// URL to cd:/" do
      relurl = Yast2::RelURL.new("cd:/", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("cd:/test")
    end

    it "works with cifs:// URL" do
      relurl = Yast2::RelURL.new("cifs://server/share/path", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("cifs://server/share/path/test")
    end

    it "works with nfs:// URL" do
      relurl = Yast2::RelURL.new("nfs://server/export/path", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("nfs://server/export/path/test")
    end

    it "works with file:/ base URL" do
      relurl = Yast2::RelURL.new("file:/foo/bar", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("file:///foo/bar/test")
    end

    it "corrects file:// base URL to file:///" do
      relurl = Yast2::RelURL.new("file://foo/bar", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("file:///foo/bar/test")
    end

    it "works with file:/// base URL" do
      relurl = Yast2::RelURL.new("file:///", "relurl://test")
      expect(relurl.absolute_url.to_s).to eq("file:///test")
    end

    it "follows '..' with file:/ base URL properly" do
      relurl = Yast2::RelURL.new("file:/foo/bar", "relurl://../../test")
      expect(relurl.absolute_url.to_s).to eq("file:///test")
    end

    it "adds the requested path to the absolute URL" do
      relurl = Yast2::RelURL.new("http://example.com/foo", "relurl://test")
      expect(relurl.absolute_url("path").to_s).to eq("http://example.com/foo/test/path")
    end

    it "allow the requested path to go up in the relative path" do
      relurl = Yast2::RelURL.new("http://example.com/foo", "relurl://test")
      expect(relurl.absolute_url("../path").to_s).to eq("http://example.com/foo/path")
    end

    it "allows the requested path to go up in the path even to the base URL" do
      relurl = Yast2::RelURL.new("http://example.com/foo", "relurl://test")
      expect(relurl.absolute_url("../../path").to_s).to eq("http://example.com/path")
    end

    it "returns the path if both relative and base URLs are empty" do
      relurl = Yast2::RelURL.new("", "")
      # might not be exactly what you would expect as the result but this is a corner
      # case, do not overengineer the code, the most important fact is that it does
      # not crash and the result is a valid file path
      expect(relurl.absolute_url("foo/bar").to_s).to eq("/foo/bar")
    end
  end

  describe ".from_installation_repository" do
    before do
      allow(Yast::InstURL).to receive(:installInf2Url).and_return(inst_url)
    end

    let(:rel_url) { "relurl:/test" }
    subject { Yast2::RelURL.from_installation_repository(rel_url) }

    context "during installation" do
      let(:inst_url) { "http://example.com/repo" }

      it "returns URL relative to the installation repository" do
        expect(subject.absolute_url.to_s).to eq("http://example.com/repo/test")
      end
    end

    context "in an installed system" do
      let(:inst_url) { "" }

      it "returns the original relative URL" do
        expect(subject.absolute_url.to_s).to eq(rel_url)
      end
    end
  end
end

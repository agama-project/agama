# frozen_string_literal: true

# See ./README.md for standalone usage
# TODO: remember to set up and test the --host option after all

require "cheetah"
require "webrick"

# @param filename relative to git repo root
# @return usable for this suite
def fixture(filename)
  # the tests specify the paths relative to repo root
  # but we run in service/
  "../" + filename
end

# @param filename relative to git repo root
# @return usable for this suite, absolute
def abs_fixture(filename)
  File.absolute_path(fixture(filename))
end

def cheetah_kwargs
  {
    stdout:             :capture,
    stderr:             :capture,
    allowed_exitstatus: 0..255
  }
end

WEB_SERVER_PORT = 8000

# @return [HTTPServer]
def web_server_start
  root = abs_fixture(".")
  server = WEBrick::HTTPServer.new(Port: WEB_SERVER_PORT, DocumentRoot: root)
  Thread.new { server.start }
  server
end

def web_server_shutdown(server)
  server.shutdown
end

# needs declarations:
# command [Array<String>] like ["agama", "profile", "validate"]
shared_examples "accepts input in 3 ways" do |filename, stdout_match, stderr_match|
  context "with #{filename} as path" do
    it "output matches" do
      cmd = [*command, fixture(filename)]
      stdout, stderr = Cheetah.run(*cmd, **cheetah_kwargs)
      expect(stdout).to include(stdout_match)
      expect(stderr).to include(stderr_match)
    end
  end

  context "with #{filename} as http URL" do
    it "output matches" do
      url = "http://localhost:#{WEB_SERVER_PORT}/#{filename}"
      cmd = [*command, url]
      stdout, stderr = Cheetah.run(*cmd, **cheetah_kwargs)
      expect(stdout).to include(stdout_match)
      expect(stderr).to include(stderr_match)
    end
  end

  context "with #{filename} as stdin" do
    it "output matches" do
      input = File.read(fixture(filename))
      cmd = [*command, "-"]
      stdout, stderr = Cheetah.run(*cmd, stdin: input, **cheetah_kwargs)
      expect(stdout).to include(stdout_match)
      expect(stderr).to include(stderr_match)
    end
  end
end

describe "agama config" do
  before(:all) do
    @web_server = web_server_start
  end

  after(:all) do
    web_server_shutdown(@web_server)
  end

  describe "validate:" do
    let(:command) { ["agama", "config", "validate"] }
    context "valid profile" do
      include_examples \
        "accepts input in 3 ways", \
        "rust/agama-lib/share/examples/profile_tw_minimal.json", \
        "", \
        "is valid"
    end

    context "valid profile with space in path" do
      include_examples \
        "accepts input in 3 ways", \
        "rust/agama-lib/share/examples space/profile_tw_minimal.json", \
        "", \
        "is valid"
    end

    # Rust Url library will see the percent
    # and wrongly think that the path does not need escaping.
    # This is a bug but its impact is low.
    xcontext "valid profile with percent in path" do
      include_examples \
        "accepts input in 3 ways", \
        "rust/agama-lib/share/examples%20percent/profile_tw_minimal.json", \
        "", \
        "is valid"
    end

    context "invalid profile" do
      include_examples \
        "accepts input in 3 ways", \
        "rust/agama-lib/share/examples/profile_tw_invalid.json", \
        "", \
        "* Additional properties are not allowed ('ID' was unexpected). /product"
    end
  end

  describe "generate:" do
    context "config contains relative URL references:" do
      let(:profile_body) do
        json = <<~JSON
          {
            "scripts": {
              "postPartitioning": [
                {
                  "name": "foo",
                  "url": "my-script.sh"
                }
              ]
            }
          }
        JSON
        json
      end

      it "they are resolved" do
        output = Cheetah.run("agama", "config", "generate", "-",
          stdout: :capture, stdin: profile_body)
        # FIXME: better match. for now we assume that a "/" is a correct resolution
        expect(output).to include("/my-script.sh")
      end
    end
    context "jsonnet, by stdin" do
      let(:profile_body) { '{product: {uh: "oh"}}' }

      it "is evaluated" do
        output = Cheetah.run("agama", "config", "generate", "-",
          stdout: :capture, stdin: profile_body)
        expected = <<~JSON
          {
             "product": {
                "uh": "oh"
             }
          }
        JSON
        expect(output).to eq(expected)
      end
    end
  end

  describe "generate (autoyast):" do
    let(:command) { ["agama", "config", "generate"] }

    let(:output_match) do
      json = <<~JSON
        {
          "product": {
            "id": "Tumbleweed"
          },
          "software": {
            "patterns": [
              "base"
            ],
            "packages": []
          }
        }
      JSON
      json
    end

    # I want to test that YaST special schemes like label:
    # are handled, but unable to make them work in my testing environment
    xcontext "XML, with a YaST special URL" do
      let(:filename) { "service/test/fixtures/profiles/trivial_tw.xml" }
      let(:label_url) { "label://mylabel#{abs_fixture(filename)}" }
    end

    context "XML, with file:/// URL" do
      let(:filename) { "service/test/fixtures/profiles/trivial_tw.xml" }

      it "output matches" do
        url = "file://" + abs_fixture(filename)
        output = Cheetah.run(*command, url, stdout: :capture)
        expect(output).to include(output_match)
      end
    end

    context "ERB, with file:/// URL" do
      let(:filename) { "service/test/fixtures/profiles/trivial_tw.xml.erb" }

      it "output matches" do
        url = "file://" + abs_fixture(filename)
        output = Cheetah.run(*command, url, stdout: :capture)
        expect(output).to include(output_match)
      end
    end

    # I get a deadlock because two processes want the libstorage lock. why?
    xcontext ".../, with file:/// URL" do
      let(:filename) { "service/test/fixtures/profiles/profile/" }

      it "output matches" do
        url = "file://" + abs_fixture(filename)
        output = Cheetah.run(*command, url, stdout: :capture)
        # this claim is too weak but the test needs to be fixed first
        expect(output).to include("Tumbleweed")
      end
    end
  end
end

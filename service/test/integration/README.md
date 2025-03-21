# Service Integration Tests

These tests need the Agama services running, both the Ruby part (`service/`) and the Rust part (`rust/`).

They are written with RSpec because it was convenient.

To not get run together with the `*_test.rb` unit tests, these are named `*_itest.rb`

### Running

We run this via `.github/wotkflows/ci-integration-tests.yml`, or like this

```sh
(cd service; bundle exec rspec --pattern 'test/integration/**_itest.rb')
```

Safety and security: will this delete data and/or unset root password on your machine?
We hope not but we do run the tests in a testing container to isolate mistakes.

### Other Integration Tests

See also <https://github.com/agama-project/integration-tests> which exercises also the web UI.

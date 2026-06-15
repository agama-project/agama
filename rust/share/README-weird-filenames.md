This directory contains files with unusual names:
Containing a space (U+0020), or containing a URL-encoded space "%20".
This is for integration tests to detect insufficient or too eager
URL encoding and decoding.

When you see naughty%20file.json you may think "Come on, that's
actually 'naughty file.json' and someone saved it wrong."
Yes, but it is not this software's job to improve people's file names.

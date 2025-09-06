#!/bin/sh

API_BASE_URL=$(printf '%s' "$API_BASE_URL" | sed -e 's/[&/\]/\\&/g')
sed -i "s/___REPLACEME_NOCTF_API_BASE_URL___/$API_BASE_URL/g" /public/_app/immutable/chunks/*.js
"$@"
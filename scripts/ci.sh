#!/bin/bash
export GIT_ROOT=`git rev-parse --show-toplevel`
changed=`git diff --name-only "$GIT_BEFORE" "$GIT_AFTER" | egrep '^pkg/' | cut -f2 -d'/' | sort | uniq`
deps=`node "$GIT_ROOT/scripts/get-dependents" "$changed"`
set -x

yarn workspaces foreach -pitv --from "$deps" run ci
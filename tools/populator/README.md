Crude tooling to help populate the database with test data.

Copying all the challenge configs from DUCTF 2024:

```sh
for f in /tmp/Challenges_2024_Public/**/ctfcli.yaml;
do
cp $f "challenge_configs/$(basename "$(dirname "$f")").yml"
done
```

Upload them (doesn't add files, also hardcodes all flags to "flag"):

```sh
python3 challenge_upload.py --base-url http://localhost:8000 --email admin@admin.com --password adminadmin --directory challenge_configs/
```

Solver simulator:

```sh
python3 challenge_solver.py --base-url http://localhost:8000 --user-count 50 --max-solves 40 --min-delay 10 --max-delay 300 --time-limit 90
```

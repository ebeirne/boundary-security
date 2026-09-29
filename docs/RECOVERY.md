# Workspace recovery

Boundary 0.2 writes a complete temporary file, flushes it, saves the previous state as `.boundary/state.json.bak`, and replaces `state.json`. Memory advances only after the write succeeds. The backup is one previous committed snapshot, not a complete backup history or protection against disk loss.

Before upgrading, stop the server and copy the entire `.boundary` directory to a separate safe location. Keep the previous release as well. Inputs remain plaintext; only use reviewed SQL and synthetic data.

If startup reports an invalid workspace:

1. Stop every Boundary server using that directory. Preserve copies of `state.json`, `state.json.bak`, and any `.tmp` file. Do not overwrite the failed original.
2. Inspect the backup without executing its SQL:

   `node server/check-workspace.mjs .boundary/state.json.bak`

3. If validation succeeds, rename the failed original to a dated quarantine filename, then copy the verified backup to `state.json`. Restart. The backup may lack the most recent committed change; compare the retained files before discarding anything.
4. If validation fails, keep the files and investigate. Boundary deliberately does not silently replace damaged evidence with an empty workspace.

`workspace.lock` prevents two servers from writing the same workspace. A lock from a process confirmed no longer running is automatically removed. If the PID was reused or a lock cannot be read, startup stops; verify the old server is stopped before manually preserving/removing that lock.

Version 0.2 reads version 0.1 workspace records without changing old evidence. New source fingerprints encode migration and seed separately. Old runs may appear historical after upgrading; rerun the contract. Old checksums remain valid. Returning to 0.1 should use the separately retained pre-upgrade workspace.

Power-loss durability of the containing directory and network filesystem behavior are not certified. Keep this workspace on a local filesystem with independent backups.

## Version 0.6 verified recovery copies

On the Projects page, choose **Save workspace backup**. The receipt shows the verified file in `.boundary/backups`. Copy it to a separate safe location. The backup contains projects and assessment history, including plaintext SQL and synthetic fixtures. It does not include exported report files; those can be regenerated from the runs. Backups are not encrypted or automatically rotated. A checksum detects accidental damage, not deliberate rewriting.

For scripted use:

```sh
node scripts/backup.mjs create .boundary my-backup.json
node scripts/backup.mjs verify my-backup.json
node scripts/backup.mjs restore my-backup.json recovered-workspace
```

Creation refuses to overwrite a file. Restoration validates the checksum and workspace evidence before creating a **new** directory; it refuses an existing destination. SQL is never executed during backup or restore. A failed write may leave an incomplete new destination; preserve it for diagnosis and use a different destination after resolving disk errors.

To use a restored workspace, stop Boundary, preserve the original `.boundary` directory under another name, and rename the verified recovered directory to `.boundary`. Restart Boundary and check the project/run counts. Keep the preserved original until recovery is confirmed. File flushing is performed; power-loss durability and network filesystems remain unverified.


## Unsupported versions
Boundary refuses workspaces with an explicit formatVersion other than 1. Keep the original bytes and open them using a compatible release. Do not remove or change the version field to bypass this check. Legacy files without a format field remain supported.


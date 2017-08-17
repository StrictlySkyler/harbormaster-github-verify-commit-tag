# harbormaster-github-verify-branch-tag
Verify that your branches are tagged before merging into a shared branch.

This harbormaster plugin allows triggering via a GitHub Webhook, and will attempt to checkout any branch it is notified of, verify that the `HEAD` of that branch has a tag, and then post the status back to GitHub for that hash.

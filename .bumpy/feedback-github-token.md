---
"inflation-station": minor
---

The Feedback widget now files issues through the GitHub REST API instead of the `gh` CLI, so it works in the Docker image. Set `FEEDBACK_GITHUB_TOKEN` to a fine-grained token with Issues read and write on `FEEDBACK_GITHUB_REPO`. Without the token, the widget stays hidden.

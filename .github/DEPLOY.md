# Automatic deploy to smahfuzm.in

Every push to `main` runs `.github/workflows/deploy.yml`. GitHub logs into the server over SSH, the server runs
`git pull` in the site folder, and the workflow then checks that https://smahfuzm.in/quran-noor/ serves the new
version. A deploy takes about 20–30 seconds; each run shows in the repository's **Actions** tab.

The SSH key used for this can do one thing only: run that `git pull`. Even if it leaked, it could not open a shell.

## One-time setup

### 1. On the server — make a key that can only pull

Log in to the server as the user who owns the site folder (the same user your current timed pull runs as), then:

```bash
cd /path/to/quran-noor          # the folder that serves smahfuzm.in/quran-noor/
pwd                             # note this full path for the next step
git pull --ff-only              # must work without asking for a password
ssh-keygen -t ed25519 -N "" -C "github-deploy quran-noor" -f ~/quran-noor-deploy
```

Add the public key to `~/.ssh/authorized_keys`, locked to the pull command. Use the path printed by `pwd`:

```bash
echo "command=\"git -C /FULL/PATH/quran-noor pull --ff-only -q origin main\",restrict $(cat ~/quran-noor-deploy.pub)" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Show the private key so you can copy it into GitHub in step 2, then delete both key files from the server:

```bash
cat ~/quran-noor-deploy         # copy everything, including the BEGIN and END lines
rm ~/quran-noor-deploy ~/quran-noor-deploy.pub
```

### 2. On GitHub — add four secrets

Repository **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `SSH_HOST` | `smahfuzm.in` |
| `SSH_USER` | the server user from step 1 |
| `SSH_KEY` | the private key you copied (all of it) |
| `SSH_KNOWN_HOSTS` | the three lines below (the server's public host keys, read on 2026-11-26) |
| `SSH_PORT` | optional — only if SSH is not on port 22 |

```
smahfuzm.in ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGmD3eAfE+ovpo7+FIkmOx9bN6S84uSjAosCF6yc42cw
smahfuzm.in ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBNmWXvdusr3ZzfOx+PKDpTvdbMdccY7r0qPisjhisWopmthhDhDtCwO06B78I25nKhQExluwjUEwSxVTIvuijAk=
smahfuzm.in ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCWJYt+YZQg3MLDFdpVvEMDu9G98A/gR3PvBF/CBbwNfCoWjBm/euzEimhjK70e/WPrd4ItIjtqMkKabS8aWSoFJ+d4tiOP+iB0isoID2aIPekOiWYGW9TpVd6IoXAzl7aZYxPpgaFlyKaZAomJ8kT3jib5rqpq9tRBwiWgHeOemKLd3/h6gAXP6L1rl4pkY1c24qeg2N+WL4CoUBMSAkBakKDllICgixN5L9+6sp+POnLft4WeErlwY9vxc3SX/oyMoeml9ITpqC8x6aWuAzapj64lakfeVCRgSyQOpnGATr/CLFuW9BM88S/n0G5x/fnutgf/cA/gmIO6HD3rNoc6luV5h/Wukdq8xmmP+erhEflg+A3EgZpbkNAZlSWQ2OPT4Oqsyt3ezs5rGaInjKyhwcukqFeXpawUgyVypufxQuI2J+cZXqTQh+7MTQtZD8joxc+fhzrbbr/YcyFvlsl90wCHStcRKsSzL0dWNpVBnejgXS/sK+IBN/A2ulHgnRk=
```

To confirm these really are your server's keys, run `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server;
it should print `SHA256:OQ9yGgxfjYrmrDvwB6lk/lxAYf720y5ISTiGVyWvZf8`.

### 3. Test it

**Actions → Deploy to smahfuzm.in → Run workflow.** A green ✓ with "Live site is on VERSION = '…'" means it works.
From then on every push deploys by itself.

Your old timed pull can stay as a backup or be removed (`crontab -e`); the two do not conflict.

## If a deploy fails

| What the log says | Cause |
|---|---|
| "Deploy skipped — repository secrets not set" (yellow warning) | step 2 not done yet |
| `Permission denied (publickey)` | wrong `SSH_USER`, or the authorized_keys line is wrong or not saved |
| `Host key verification failed` | `SSH_KNOWN_HOSTS` is missing a line, or the server's host key changed |
| `Not possible to fast-forward` / `would be overwritten` | files were edited directly on the server — undo those edits there |
| "still serves … instead of …" | the pull worked but Apache serves a different folder, or a cache is in front |

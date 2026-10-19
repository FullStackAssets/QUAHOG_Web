#!/usr/bin/env python3
"""Narrows cycle deploy: push QUAHOG_Web source (main) and built dist (preview) to GitHub, enable Pages.

Uses the stored custom.github credential via authd surrogate (never a raw token).
Follows GitHub's 307 redirects (gh.py's _call does not).

Usage:
    deploy-preview.py --seed            seed empty repo via Contents API
    deploy-preview.py --push-main       push tracked source files to main
    deploy-preview.py --push-preview    push dist/ to the preview branch
    deploy-preview.py --pages           enable GitHub Pages on preview branch
    deploy-preview.py --all             everything in order
"""
from __future__ import annotations
import argparse, base64, http.client, json, os, subprocess, sys, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, '/opt/muse/skills/custom-connector-setup/bin')
import dynamic_credentials as dc

REPO = "Full-Stack-Assets/QUAHOG_Web"
REPO_ID = 1378752975  # avoids the /repos/... 307 redirect
CRED = "custom.github"
HOSTS = ["api.github.com"]
ROOT = os.path.expanduser("~/workspace/quahog-web")


def api(method, path, payload=None, timeout=120):
    url = f"https://api.github.com{path}"
    for redir in range(5):
        data = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"})
        if data is not None:
            req.add_header("Content-Type", "application/json")
        dc.add_surrogate_to_request(req, CRED, allowed_hosts=HOSTS)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return dc.read_json_response(resp)
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308):
                url = e.headers.get("Location")
                continue
            body = e.read().decode(errors="replace")[:400]
            sys.exit(f"HTTP {e.code} on {method} {path}: {body}")
        except (http.client.RemoteDisconnected, urllib.error.URLError,
                http.client.IncompleteRead, ConnectionError) as e:
            time.sleep(3)
            continue
    sys.exit(f"redirect loop on {method} {path}")


def seed():
    text = "# QUAHOG_Web\n\nThe Narrows - authoritative browser runtime. Cycle 1 baseline.\n"
    r = api("PUT", f"/repositories/{REPO_ID}/contents/README.md", {
        "message": "Seed: initial README (enables Git Data API)",
        "content": base64.b64encode(text.encode()).decode(), "branch": "main"})
    print("seeded:", r["commit"]["sha"][:8], flush=True)


def tracked_files():
    out = subprocess.run(
        ["git", "-c", "core.quotePath=false", "ls-files"],
        cwd=ROOT, capture_output=True, text=True, check=True)
    return [f for f in out.stdout.splitlines() if f]


def dist_files():
    dist = os.path.join(ROOT, "dist")
    files = []
    for dp, _, fns in os.walk(dist):
        for fn in fns:
            full = os.path.join(dp, fn)
            files.append(os.path.relpath(full, dist))
    return files


def make_blob(args):
    repo_path, local_path = args
    with open(local_path, "rb") as f:
        content = f.read()
    for attempt in range(3):
        try:
            blob = api("POST", f"/repositories/{REPO_ID}/git/blobs", {
                "content": base64.b64encode(content).decode(), "encoding": "base64"})
            return repo_path, blob["sha"]
        except SystemExit:
            raise
        except Exception as e:
            time.sleep(2 * (attempt + 1))
    sys.exit(f"blob failed: {repo_path}")


def push_branch(branch, file_pairs, message, base_prefix=""):
    """file_pairs: list of (repo_path, local_abs_path). Creates branch if missing."""
    try:
        ref = api("GET", f"/repositories/{REPO_ID}/git/ref/heads/{branch}")
        base_sha = ref["object"]["sha"]
        base_commit = api("GET", f"/repositories/{REPO_ID}/git/commits/{base_sha}")
        base_tree = base_commit["tree"]["sha"]
        parents = [base_sha]
        print(f"base: {branch} = {base_sha[:8]}", flush=True)
    except SystemExit:
        base_tree, parents = None, []
        print(f"base: {branch} does not exist, creating", flush=True)

    print(f"creating {len(file_pairs)} blobs...", flush=True)
    t0 = time.time()
    entries = []
    done = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        for repo_path, sha in ex.map(make_blob, file_pairs):
            entries.append({"path": repo_path, "mode": "100644", "type": "blob", "sha": sha})
            done += 1
            if done % 200 == 0:
                print(f"  {done}/{len(file_pairs)} blobs ({time.time()-t0:.0f}s)", flush=True)
    print(f"blobs done in {time.time()-t0:.0f}s", flush=True)

    tree_payload = {"tree": sorted(entries, key=lambda e: e["path"])}
    if base_tree:
        tree_payload["base_tree"] = base_tree
    tree = api("POST", f"/repositories/{REPO_ID}/git/trees", tree_payload)
    commit = api("POST", f"/repositories/{REPO_ID}/git/commits",
                 {"message": message, "tree": tree["sha"], "parents": parents})
    new_sha = commit["sha"]
    if parents:
        api("PATCH", f"/repositories/{REPO_ID}/git/refs/heads/{branch}", {"sha": new_sha})
    else:
        api("POST", f"/repositories/{REPO_ID}/git/refs",
            {"ref": f"refs/heads/{branch}", "sha": new_sha})
    print(f"pushed: {branch} = {new_sha[:8]}", flush=True)
    return new_sha


def enable_pages():
    r = api("PUT", f"/repositories/{REPO_ID}/pages",
            {"source": {"branch": "preview", "path": "/"}})
    print("pages:", r.get("html_url"), "status:", r.get("status"), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", action="store_true")
    ap.add_argument("--push-main", action="store_true")
    ap.add_argument("--push-preview", action="store_true")
    ap.add_argument("--pages", action="store_true")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()

    if a.seed or a.all:
        seed()
    if a.push_main or a.all:
        pairs = [(f, os.path.join(ROOT, f)) for f in tracked_files()]
        push_branch("main", pairs, "Cycle 1 baseline: QUAHOG_Web snapshot (tests 29/29, build clean)")
    if a.push_preview or a.all:
        dist = os.path.join(ROOT, "dist")
        pairs = [(f, os.path.join(dist, f)) for f in dist_files()]
        push_branch("preview", pairs, "Cycle 1 preview build")
    if a.pages or a.all:
        enable_pages()


if __name__ == "__main__":
    main()

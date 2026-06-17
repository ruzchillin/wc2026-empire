(async () => {
  const blobCount = Object.keys(window._blobs).length;
  if (blobCount === 0) return 'ERROR: no blobs uploaded';
  
  // Build tree entries
  const tree = Object.entries(window._blobs).map(([path, sha]) => ({
    path, mode: '100644', type: 'blob', sha
  }));
  
  // Create tree
  const treeR = await fetch('https://api.github.com/repos/' + window._owner + '/' + window._repo + '/git/trees', {
    method: 'POST',
    headers: {'Authorization': 'token ' + window._token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json'},
    body: JSON.stringify({base_tree: window._currentTree, tree})
  });
  const treeD = await treeR.json();
  if (!treeD.sha) return 'Tree error: ' + JSON.stringify(treeD).substring(0,200);
  
  // Create commit
  const commitR = await fetch('https://api.github.com/repos/' + window._owner + '/' + window._repo + '/git/commits', {
    method: 'POST',
    headers: {'Authorization': 'token ' + window._token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json'},
    body: JSON.stringify({
      message: 'WC 2026 Empire — full deploy: ' + blobCount + ' files, 43 engines, full automation',
      tree: treeD.sha,
      parents: [window._headSha]
    })
  });
  const commitD = await commitR.json();
  if (!commitD.sha) return 'Commit error: ' + JSON.stringify(commitD).substring(0,200);
  
  // Update branch HEAD
  const refR = await fetch('https://api.github.com/repos/' + window._owner + '/' + window._repo + '/git/refs/heads/main', {
    method: 'PATCH',
    headers: {'Authorization': 'token ' + window._token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json'},
    body: JSON.stringify({sha: commitD.sha, force: true})
  });
  const refD = await refR.json();
  
  return 'SUCCESS! Committed ' + blobCount + ' files. Commit: ' + commitD.sha + ' Branch: ' + refD.ref;
})();
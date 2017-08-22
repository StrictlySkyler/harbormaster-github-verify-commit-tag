/* eslint strict: ["error", "global"], import/no-unresolved: 0 */
/* global $H */

'use strict';

const NAME = 'github_verify_branch_tag';
const dependencies = ['uuid', 'expand-tilde', 'debug'].join(' ');

require('child_process').execSync(`npm i ${dependencies}`);

const log = require('debug')(`${NAME}:log`);

log('Dependencies installed:', dependencies);

const fs = require('fs');
const uuid = require('uuid');
const expandTilde = require('expand-tilde');
const exec = require('child_process').execSync;

const tmp = expandTilde('~/.harbormaster/tmp');

if (!fs.existsSync(tmp)) {
  log('No temp directory found at:\n', tmp);
  fs.mkdirSync(tmp);
  log('Temp directory created:\n', tmp);
}

module.exports = {

  render_input: function renderInput() {
    return `
      <p>This lane is triggered via RPC, and provides no manual configuration.</p>
    `;
  },

  render_work_preview: function renderWorkPreview() {
    return `
      <p>This lane will do the following when called:</p>
      <ol>
        <li>Clone the git repo in question to a temporary location</li>
        <li>Checkout the branch in question</li>
        <li>Check that a tag has been assigned to the latest commit</li>
        <li>Post the results back to the corresponding hash in GitHub</li>
        <li>Remove the repo from the temporary location</li>
      </ol>
    `;
  },

  register: function register() { return NAME; },

  update: function update() { return false; },

  work: (lane, manifest) => {
    let results;
    let exitCode = 1;

    const newManifest = manifest;

    const githubUser = process.env.GITHUB_USER;
    const githubToken = process.env.GITHUB_TOKEN;

    const commitHash = manifest.prior_manifest.after;
    const fullName = manifest.prior_manifest.repository.full_name;
    const shipmentDate = manifest.shipment_start_date;
    const repoProtocol = 'https://';
    const auth = githubUser ? `${githubUser}:${githubToken}@` : '';
    const repoUrl = `${repoProtocol}${auth}github.com/${fullName}`;

    const instanceHash = uuid.v4();

    const cloneCommand = `git clone ${repoUrl} ${instanceHash}`;
    const checkoutCommand = `git checkout ${commitHash}`;
    const checkTagCommand = 'git describe --exact-match --tags HEAD';
    const repoPath = `${tmp}/${instanceHash}`;
    const removeCommand = `rm -rf ${repoPath}`;

    const contentType = 'application/json';
    const userAgent = 'GitHub Verify Branch Tag Service';
    const statusUrl =
      `https://api.github.com/repos/${fullName}/statuses/${commitHash}`;
    const errorState = 'error';
    const successState = 'success';
    const failureState = 'failure';
    const targetUrl =
      `${process.env.ROOT_URL}/${lane.name}/ship/${shipmentDate}`;
    const errorDescription = 'There was an error checking the branch tag.';
    const successDescription = 'This branch has been tagged.';
    const failureDescription = 'Unable to find a tag for this branch!';
    const context = 'continuous-integration/harbormaster';

    const options = {
      data: {
        state: errorState,
        targetUrl,
        description: errorDescription,
        context,
      },
      headers: {
        'User-Agent': userAgent,
        'Content-Type': contentType,
        Authorization: `token ${githubToken}`,
      },
    };

    exec(cloneCommand, { cwd: tmp });
    exec(checkoutCommand, { cwd: repoPath });

    try {
      results = exec(checkTagCommand, { cwd: repoPath, encoding: 'utf8' });
      log('Tag found.  Sending success status.');
      options.data.state = successState;
      options.data.description = successDescription;
      exitCode = 0;
      newManifest.data = results;
    } catch (err) {
      log('No tag found.  Sending failure status.');
      options.data.state = failureState;
      options.data.description = failureDescription;
      exitCode = 2;
      newManifest.error = err;
    }

    $H.HTTP.post(statusUrl, options);

    exec(removeCommand);

    $H.call('Lanes#end_shipment', lane, exitCode, newManifest);

    return newManifest;
  },
};


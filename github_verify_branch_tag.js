'use strict';

let dependencies = ['uuid', 'expand-tilde'].join(' ');

console.log('Installing dependencies:', dependencies, '...');
require('child_process').execSync(
  'npm i ' + dependencies
);
console.log('Dependencies installed:', dependencies);

let fs = require('fs');
let uuid = require('uuid');
let expand_tilde = require('expand-tilde');
let exec = require('child_process').execSync;

let tmp = expand_tilde('~/.harbormaster/tmp');

if (! fs.existsSync(tmp)) {
  console.log('No temp directory found at:\n', tmp);
  fs.mkdirSync(tmp);
  console.log('Temp directory created:\n', tmp);
}

let Lanes;
let Users;
let Harbors;
let Shipments;
const NAME = 'github_verify_branch_tag';

module.exports = {

  render_input: (values) => {
    return `
      <p>This lane is triggered via RPC, and provides no manual configuration.</p>
    `
  },

  render_work_preview: (manifest) => {
    return `
      <p>This lane will do the following when called:</p>
      <ol>
        <li>Clone the git repo in question to a temporary location</li>
        <li>Checkout the branch in question</li>
        <li>Check that a tag has been assigned to the latest commit</li>
        <li>Post the results back to the corresponding hash in GitHub</li>
        <li>Remove the repo from the temporary location</li>
      </ol>
    `
  },

  register: (lanes, users, harbors, shipments) => {
    Lanes = lanes;
    Users = users;
    Harbors = harbors;
    Shipments = shipments;

    return NAME;
  },

  update: (lane, values) => {
    let harbor = Harbors.findOne(lane.type);

    if (values.seconds) values.seconds = parseInt(values.seconds, 10);

    harbor.lanes[lane._id] = {
      manifest: values
    };

    Harbors.update(harbor._id, harbor);

    if (typeof values.seconds == 'number') return true;

    return false;
  },

  work: (lane, manifest) => {
    let commit_hash = manifest.prior_manifest.after;
    let repo_url = manifest.prior_manifest.repository.url;
    let full_name = manifest.prior_manifest.repository.full_name;
    let shipment_date = manifest.shipment_start_date;
    let instance_hash = uuid.v4();
    let clone_command = `git clone ${repo_url} ${instance_hash}`;
    let checkout_command = `git checkout ${commit_hash}`;
    let check_tag_command = 'git describe --exact-match --tags HEAD';
    let repo_path = `${tmp}/${instance_hash}`;
    let remove_command = `rm -rf ${repo_path}`
    let github_token = process.env.GITHUB_TOKEN;
    let content_type = 'application/json';
    let user_agent = 'GitHub Verify Branch Tag Service';
    let status_url =
      `https://api.github.com/repos/${full_name}/statuses/${commit_hash}`;
    let error_state = 'error';
    let success_state = 'success';
    let failure_state = 'failure';
    let target_url =
      `${process.env.ROOT_URL}/${lane.name}/ship/${shipment_date}`;
    let error_description = 'There was an error checking the branch tag.';
    let success_description = 'This branch has been tagged.';
    let failure_description = 'Unable to find a tag for this branch!';
    let context = 'continuous-integration/harbormaster';

    let options = {
      data: {
        'state': error_state,
        'target_url': target_url,
        'description': error_description,
        'context': context
      },
      headers: {
        'User-Agent': user_agent,
        'Content-Type': content_type,
        'Authorization': `token ${github_token}`
      }
    };

    exec(clone_command, { cwd: tmp });
    exec(checkout_command, { cwd: repo_path });

    try {
      exec(check_tag_command, { cwd: repo_path, encoding: 'utf8' });
      console.log('Tag found.  Sending success status.');
      options.data.state = success_state;
      options.data.description = success_description;
    } catch (e) {
      console.log('No tag found.  Sending failure status.');
      options.data.state = failure_state;
      options.data.description = failure_description;
    }

    $H.HTTP.post(status_url, options);

    exec(remove_command);

    return manifest;
  }
}


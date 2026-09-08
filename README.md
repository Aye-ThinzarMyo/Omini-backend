# README #

This README would normally document whatever steps are necessary to get your application up and running.

### What is this repository for? ###

* Quick summary
* Version
* [Learn Markdown](https://bitbucket.org/tutorials/markdowndemo)

### How do I get set up? ###

* `npm install`, then copy `.env.example` to `.env` and fill it in.
* `npm run dev` (nodemon) or `npm start`; in UAT it runs under PM2 as `Omni_Backend`.
* FreePBX WebRTC provisioning needs a one-time MySQL user + firewall setup on
  the PBX host — see [docs/freepbx-webrtc-setup.md](docs/freepbx-webrtc-setup.md).
* Call recording is decided per route/queue/extension — read
  [docs/freepbx-call-recording-plan.md](docs/freepbx-call-recording-plan.md) before changing it.

### Contribution guidelines ###

* Writing tests
* Code review
* Other guidelines

### Who do I talk to? ###

* Repo owner or admin
* Other community or team contact
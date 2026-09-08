# FreePBX WebRTC settings — MySQL access setup

When a user is created, the backend provisions a FreePBX extension over GraphQL
and then applies the WebRTC endpoint settings (Enable AVPF, Enable ICE Support,
Enable RTCP Mux, Media Encryption = DTLS-SRTP, Enable DTLS). The Core GraphQL
schema does not expose those settings, so the backend writes them directly into
FreePBX's `asterisk.sip` table over the private network — the same table the
admin UI reads — and then triggers a reload over GraphQL. The code is
`enableWebrtcSettings()` in [`src/services/freepbx.js`](../src/services/freepbx.js).

This guide sets that up once per PBX. Nobody has to touch the FreePBX UI per
user afterwards.

```
 backend host                                   FreePBX host
 ────────────                                   ────────────
 createFreepbxExtension()
   ├─ addExtension        ── GraphQL/HTTPS ──►  FreePBX API
   ├─ updateExtension     ── GraphQL/HTTPS ──►  FreePBX API
   ├─ enableWebrtcSettings ── MySQL :3306 ───►  MariaDB  asterisk.sip
   │                          (private IP)        INSERT … ON DUPLICATE KEY UPDATE
   └─ doreload            ── GraphQL/HTTPS ──►  FreePBX API → fwconsole reload
                                                  regenerates pjsip.endpoint.conf
```

## Prerequisites

- Root (or full `sudo`) shell on the FreePBX host.
- The **private IP** of the FreePBX host and of the backend host. Below they
  are `PBX_PRIVATE_IP` and `BACKEND_PRIVATE_IP`; substitute real values.
- Network path from the backend to the PBX on TCP/3306 over the private
  network (security group / VPC rules, if applicable).
- A WSS transport already enabled in FreePBX (Settings → Asterisk SIP Settings →
  PJSIP). If a WebRTC softphone already registers to this PBX, it is. Your
  `.env` has `FREEPBX_SIP_WS_SERVERS` pointing at it.

---

## Part 1 — FreePBX host: make MariaDB reachable on the private IP

Run as root on the PBX.

**1.1** Check what MariaDB currently listens on. Stock FreePBX binds to
localhost only:

```bash
ss -ltnp | grep -E ':3306\b'
```

`127.0.0.1:3306` means it is local-only and you need steps 1.2–1.3.
`0.0.0.0:3306` or `PBX_PRIVATE_IP:3306` means skip to Part 2.

**1.2** Find the config file that sets `bind-address`:

```bash
grep -rn "bind-address" /etc/my.cnf /etc/my.cnf.d/ /etc/mysql/ 2>/dev/null
```

**1.3** Set it to the private IP — not `0.0.0.0`, so the public interface is
never exposed even if the firewall is misconfigured. If the grep found a line,
edit it in place; otherwise add it under `[mysqld]`:

```bash
cat > /etc/my.cnf.d/zz-bind-private.cnf <<'EOF'
[mysqld]
bind-address = PBX_PRIVATE_IP
EOF
```

(On Debian-based hosts use `/etc/mysql/mariadb.conf.d/zz-bind-private.cnf`.
A later-sorting file overrides an earlier `bind-address`.)

**1.4** Restart and confirm — this briefly interrupts FreePBX's DB access, so
do it outside busy hours:

```bash
systemctl restart mariadb && ss -ltnp | grep -E ':3306\b'
```

You should now see `PBX_PRIVATE_IP:3306`. Note that `127.0.0.1:3306` is gone;
FreePBX itself connects via the Unix socket, so it keeps working — verify with:

```bash
fwconsole ma list >/dev/null && echo "FreePBX DB OK"
```

If that fails, FreePBX is configured to connect over TCP to 127.0.0.1. Either
revert step 1.3 and instead bind to `0.0.0.0` with a strict firewall (Part 3),
or add `127.0.0.1` alongside — MariaDB ≥ 10.11 accepts a comma list:
`bind-address = 127.0.0.1,PBX_PRIVATE_IP`.

---

## Part 2 — FreePBX host: create a least-privilege DB user

Still as root on the PBX. Generate a strong password first and keep it for
Part 4:

```bash
openssl rand -base64 32
```

**2.1** Create the user, locked to the backend's private IP, with grants on the
**one table** it needs:

```bash
mysql <<'SQL'
CREATE USER 'omni_webrtc'@'BACKEND_PRIVATE_IP' IDENTIFIED BY 'PASTE_PASSWORD_HERE';
GRANT SELECT, INSERT, UPDATE ON asterisk.sip             TO 'omni_webrtc'@'BACKEND_PRIVATE_IP';
GRANT SELECT, INSERT, UPDATE ON asterisk.certman_mapping TO 'omni_webrtc'@'BACKEND_PRIVATE_IP';
GRANT SELECT                 ON asterisk.certman_certs   TO 'omni_webrtc'@'BACKEND_PRIVATE_IP';
FLUSH PRIVILEGES;
SQL
```

Why exactly these three tables: `sip` holds the per-extension pjsip settings
(AVPF, ICE, RTCP mux, media encryption); `certman_mapping` is where the
Certificate Manager module records "Enable DTLS = Yes" for a device (a row
present = enabled) and its verify/setup/rekey values; `certman_certs` is
read-only to look up the id of the PBX's default certificate. `SELECT` covers
the existence checks and the cert lookup, `INSERT`/`UPDATE` the upserts. No
`DELETE`, nothing else in `asterisk.*`. The backend cannot do anything to the
PBX through this user beyond editing extension settings — a capability it
already has via the GraphQL admin client.

**2.2** Confirm the grants took:

```bash
mysql -e "SHOW GRANTS FOR 'omni_webrtc'@'BACKEND_PRIVATE_IP'"
```

Expected (plus a `USAGE` line):

```
GRANT SELECT, INSERT, UPDATE ON `asterisk`.`sip` TO `omni_webrtc`@`BACKEND_PRIVATE_IP`
GRANT SELECT, INSERT, UPDATE ON `asterisk`.`certman_mapping` TO `omni_webrtc`@`BACKEND_PRIVATE_IP`
GRANT SELECT ON `asterisk`.`certman_certs` TO `omni_webrtc`@`BACKEND_PRIVATE_IP`
```

**2.3** Pick the certificate new extensions will use for DTLS. List what
Certificate Manager has:

```bash
mysql asterisk -e "SELECT cid, basename, \`default\` FROM certman_certs"
```

Note the `basename` you want and put it in `FREEPBX_DTLS_CERT` (Part 4.3).
If unset, the backend uses the row with `default = 1`. To match an extension
that already works, check which cert it is bound to:

```bash
mysql asterisk -e "SELECT m.id, c.basename FROM certman_mapping m JOIN certman_certs c ON c.cid = m.cid WHERE m.id = 3022"
```

A self-signed certificate is fine for WebRTC DTLS — browsers verify the SDP
fingerprint, not the CA chain. The backend refuses to create a user if the
chosen certificate cannot be found.

---

## Part 3 — FreePBX host: firewall port 3306 to the backend only

Even bound to the private IP, restrict 3306 to the single source. Pick the
section matching what the PBX uses.

**FreePBX Firewall module (most FreePBX Distro installs)** — Connectivity →
Firewall → Services → Custom Services: add `omni-mysql`, TCP, port 3306, zone
**Trusted**; then Networks: add `BACKEND_PRIVATE_IP/32` to **Trusted**. Or
from the shell:

```bash
fwconsole firewall trust BACKEND_PRIVATE_IP
```

**firewalld**:

```bash
firewall-cmd --permanent --add-rich-rule='rule family=ipv4 source address=BACKEND_PRIVATE_IP/32 port port=3306 protocol=tcp accept' && firewall-cmd --reload
```

**ufw**:

```bash
ufw allow from BACKEND_PRIVATE_IP to any port 3306 proto tcp
```

**Cloud security group** (AWS/GCP/etc.): inbound rule TCP 3306, source =
the backend instance's security group or `BACKEND_PRIVATE_IP/32`.

---

## Part 4 — Backend host: test, then configure

**4.1** Test connectivity and the grant from the backend host **before**
touching `.env`. If `mysql` client is not installed, `apt install -y
mariadb-client` (or use the Node one-liner in 4.2).

```bash
mysql -h PBX_PRIVATE_IP -u omni_webrtc -p asterisk -e "SELECT COUNT(*) AS extensions FROM sip WHERE keyword='account'"
```

Enter the password from Part 2. A number back means networking, firewall,
user and grant are all correct.

**4.2** Alternative test using the backend's own driver (no mysql client
needed), from the repo directory:

```bash
node -e "require('mysql2/promise').createConnection({host:'PBX_PRIVATE_IP',user:'omni_webrtc',password:process.argv[1],database:'asterisk'}).then(async c=>{const [r]=await c.query(\"SELECT COUNT(*) n FROM sip WHERE keyword='account'\");console.log('extensions:',r[0].n);await c.end()}).catch(e=>{console.error(e.message);process.exit(1)})" 'PASTE_PASSWORD_HERE'
```

**4.3** Add to `.env` (see `.env.example`):

```
FREEPBX_DB_HOST=PBX_PRIVATE_IP
FREEPBX_DB_USER=omni_webrtc
FREEPBX_DB_PASSWORD=PASTE_PASSWORD_HERE
FREEPBX_DTLS_CERT=default
```

`FREEPBX_DTLS_CERT` is the certificate basename from Part 2.3. `FREEPBX_DB_PORT`
(default `3306`) and `FREEPBX_DB_NAME` (default `asterisk`) only need setting
if yours differ.

**4.4** Restart the backend so it reads the new variables:

```bash
pm2 restart Omni_Backend --update-env
```

---

## Part 5 — Verify with a real user

**5.1** Create a user through the app, then watch the backend log:

```bash
pm2 logs Omni_Backend --lines 50
```

A success is silent apart from the normal create log. A failure shows
`FreePBX createExtension failed: enableWebrtcSettings failed: …` and the
user/extension are rolled back — nothing is left half configured.

**5.2** On the PBX, confirm Asterisk picked the settings up (replace `3026`
with the new extension id):

```bash
grep -A 40 '^\[3026\]' /etc/asterisk/pjsip.endpoint.conf | grep -E 'avpf|ice_support|rtcp_mux|media_encryption|dtls'
```

Expected:

```
use_avpf=yes
media_encryption=dtls
dtls_verify=fingerprint
dtls_setup=actpass
ice_support=yes
rtcp_mux=yes
```

**5.3** Open that extension in FreePBX → Applications → Extensions →
Advanced. The WebRTC fields read **Yes** / **DTLS-SRTP**. That is expected: the
backend writes to the same table the UI reads, so the UI stays truthful.

---

## Troubleshooting

### `connect ECONNREFUSED PBX_PRIVATE_IP:3306`
MariaDB is not listening on that IP. Part 1.1/1.4 — check `ss -ltnp`.

### `connect ETIMEDOUT`
Firewall or security group is dropping the packets. Part 3. From the backend:
`nc -vz -w 3 PBX_PRIVATE_IP 3306` — "refused" means the firewall is open but
MariaDB is not bound (Part 1); a timeout means the firewall is closed.

### `Access denied for user 'omni_webrtc'@'…'`
The `@host` part of the user must match the IP the PBX **sees** the
connection coming from. If the backend has multiple interfaces or NAT is in
play, check the error text — it shows the source IP MariaDB observed — and
recreate the user for that IP (Part 2.1). Also confirm the password has no
shell-mangled characters; paste it in quotes.

### `SELECT command denied` / `INSERT command denied`
The grant is missing or on the wrong table/database. Part 2.2.

### `extension NNNN not found in FreePBX sip table`
The backend refuses to write settings for an id without an `account` row.
The GraphQL `addExtension` step reported success but no row exists — check the
extension in the FreePBX UI and the GraphQL error log. Rare; usually a FreePBX
API-module problem rather than a DB one.

### `certificate "…" (FREEPBX_DTLS_CERT) not found` / `no default certificate`
Part 2.3. The basename in `FREEPBX_DTLS_CERT` must match a row in
`certman_certs` exactly (case-sensitive); if the variable is unset, one cert
must have `default = 1`.

### Extension shows AVPF/ICE/DTLS-SRTP correctly but "Enable DTLS" is No
The `certman_mapping` row is missing — usually the grant on that table was
not added (Part 2.1) so the second upsert failed. Check `pm2 logs` for
`command denied`. Extensions created before the fix can be repaired in bulk
(replace `default` with your `FREEPBX_DTLS_CERT` basename):

```bash
mysql asterisk -e "INSERT IGNORE INTO certman_mapping (id, cid, verify, setup, rekey, auto_generate_cert) SELECT s.id, c.cid, 'fingerprint', 'actpass', 0, 0 FROM sip s JOIN certman_certs c ON c.basename = 'default' LEFT JOIN certman_mapping m ON m.id = s.id WHERE s.keyword = 'media_encryption' AND s.data = 'dtls' AND m.id IS NULL" && fwconsole reload
```

### `FREEPBX_DB_HOST / FREEPBX_DB_USER / FREEPBX_DB_PASSWORD are not set`
Part 4.3/4.4. Deliberate: creation fails loudly rather than producing an
extension that cannot make WebRTC calls.

### Settings written but the phone still cannot register / no audio
Settings are per-extension; transport is per-PBX. Confirm a WSS transport is
enabled (Prerequisites) and that `FREEPBX_SIP_WS_SERVERS` in `.env` points at
it. Also check the DTLS certificate: Admin → Certificate Management must have
a default certificate, or `dtls_cert_file` in `pjsip.endpoint.conf` is empty.

### `fwconsole ma list` failed after changing bind-address
FreePBX connects over TCP to 127.0.0.1 on this host. See the note at the end of
Part 1.4.

---

## Rotating the password

1. PBX: `mysql -e "ALTER USER 'omni_webrtc'@'BACKEND_PRIVATE_IP' IDENTIFIED BY 'NEW_PASSWORD'"`
2. Backend: update `FREEPBX_DB_PASSWORD` in `.env`.
3. `pm2 restart Omni_Backend --update-env`.

In-flight requests between steps 1 and 3 will fail and roll back cleanly; do
it during a quiet moment.

## Removing it

On the PBX: `mysql -e "DROP USER 'omni_webrtc'@'BACKEND_PRIVATE_IP'"`, remove
the Part 3 firewall rule, and optionally revert `bind-address` (Part 1.3).
Then unset the `FREEPBX_DB_*` variables — but note user creation will fail
until an alternative way to apply the WebRTC settings is in place.

## Optional: TLS on the MySQL connection

The private network is normally trusted, but if you want the link encrypted:
enable `ssl` in MariaDB's `[mysqld]` (`ssl-cert`, `ssl-key`, `ssl-ca`), then
add `ssl: { ca: fs.readFileSync(process.env.FREEPBX_DB_CA) }` to the
`mysql.createPool()` options in `freepbx.js` and `REQUIRE SSL` on the
`CREATE USER`. Not needed for the setup above to work.

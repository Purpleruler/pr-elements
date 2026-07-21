/*
 * pr-placement — Purple Ruler adaptive placement, as a Wix Custom Element.
 * Embed: Wix Editor > Add > Embed Code > Custom Element > Server URL = the GitHub Pages
 *        URL of this file, Tag Name = pr-placement.
 *
 * Attributes:
 *   member-token   a Velo-signed {email,name,iat} token (set by the Wix page). Optional in preview.
 *   subject        default "maths".
 *   api            backend base, default "https://test.purpleruler.com".
 *
 * Anti-cheat note: the LIVE version fetches each item and submits each answer to the server
 * (keys never reach the browser). This first hosted build runs a small, clearly-labelled PREVIEW
 * sequence client-side so the embed pipeline (GitHub Pages -> Wix Custom Element -> render) is
 * demonstrable before the backend lanes (wix-embed, anticheat) land.
 */
(function () {
  if (customElements.get('pr-placement')) return;

  var PREVIEW_BANK = [
    { level: 2, q: 'What is 7 x 8?', options: ['54', '56', '48', '63'], answer: 1 },
    { level: 3, q: 'Solve for x: 3x + 4 = 19', options: ['x = 5', 'x = 4', 'x = 7', 'x = 6'], answer: 0 },
    { level: 3, q: 'What is 3/4 as a decimal?', options: ['0.34', '0.75', '0.7', '0.43'], answer: 1 },
    { level: 4, q: 'Expand: (x + 3)(x + 2)', options: ['x^2 + 5x + 6', 'x^2 + 6x + 5', 'x^2 + 6', 'x^2 + 5x + 5'], answer: 0 },
    { level: 5, q: 'A right triangle has legs 6 and 8. Its hypotenuse is?', options: ['10', '12', '14', '9'], answer: 0 }
  ];

  var CSS = [
    ':host{ all: initial; display:block; }',
    '*{ box-sizing:border-box; font-family: "Sora","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }',
    '.wrap{ max-width:640px; margin:0 auto; border-radius:18px; overflow:hidden; box-shadow:0 10px 40px rgba(40,10,80,.14); background:#fff; color:#241a33; }',
    '.hd{ background:linear-gradient(90deg,#5b2a9d,#7a4fc0); color:#fff; padding:22px 26px; }',
    '.hd h2{ margin:0; font-size:20px; letter-spacing:.2px; }',
    '.hd p{ margin:6px 0 0; opacity:.85; font-size:13px; }',
    '.bd{ padding:26px; }',
    '.chip{ display:inline-block; font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px; background:#efe8fb; color:#5b2a9d; margin-bottom:14px; letter-spacing:.4px; text-transform:uppercase; }',
    '.q{ font-size:19px; font-weight:600; line-height:1.35; margin:6px 0 18px; }',
    '.opts{ display:grid; gap:10px; }',
    'button.opt{ text-align:left; padding:14px 16px; border:1.5px solid #e6def5; border-radius:12px; background:#fbf9ff; font-size:15px; cursor:pointer; transition:.12s; color:#241a33; }',
    'button.opt:hover{ border-color:#7a4fc0; transform:translateY(-1px); }',
    'button.opt:focus-visible{ outline:3px solid #b79ee6; outline-offset:2px; }',
    '.cta{ display:inline-block; background:linear-gradient(90deg,#5b2a9d,#7a4fc0); color:#fff; border:0; padding:14px 26px; border-radius:12px; font-size:15px; font-weight:600; cursor:pointer; }',
    '.cta:focus-visible{ outline:3px solid #b79ee6; outline-offset:2px; }',
    '.bar{ height:7px; background:#eee6f7; border-radius:99px; margin-bottom:20px; overflow:hidden; }',
    '.bar > i{ display:block; height:100%; background:linear-gradient(90deg,#5b2a9d,#7a4fc0); width:0; transition:width .3s; }',
    '.meta{ font-size:13px; color:#6b6280; margin-top:16px; }',
    '.ring{ text-align:center; padding:8px 0 4px; }',
    '.score{ font-size:46px; font-weight:700; color:#5b2a9d; }',
    '.band{ font-size:15px; color:#4a4160; margin-top:2px; }',
    '.note{ font-size:12px; color:#9089a6; margin-top:18px; border-top:1px solid #efeaf7; padding-top:12px; }'
  ].join('');

  function decodeName(token) {
    if (!token) return null;
    try {
      var payload = token.split('.')[0];
      payload = payload.replace(/-/g, '+').replace(/_/g, '/');
      var json = JSON.parse(decodeURIComponent(escape(atob(payload))));
      return json.name || json.email || null;
    } catch (e) { return null; }
  }

  class PrPlacement extends HTMLElement {
    connectedCallback() {
      this.subject = this.getAttribute('subject') || 'maths';
      this.api = this.getAttribute('api') || 'https://test.purpleruler.com';
      this.token = this.getAttribute('member-token') || '';
      this.name = decodeName(this.token);
      this.root = this.attachShadow({ mode: 'open' });
      this.style_ = '<style>' + CSS + '</style>';
      this.renderIntro();
    }

    frame(inner) {
      var subtitle = this.name ? ('Signed in as ' + this.name) : 'Preview mode (no member signed in)';
      this.root.innerHTML = this.style_ +
        '<div class="wrap"><div class="hd"><h2>Placement check: ' + this.subject +
        '</h2><p>' + subtitle + '</p></div><div class="bd">' + inner + '</div></div>';
    }

    renderIntro() {
      this.frame(
        '<span class="chip">Adaptive</span>' +
        '<div class="q">A few questions to find the right level for you.</div>' +
        '<p class="meta">It gets harder when you are right and easier when you are not, so it settles on your level fast. There are no wrong first answers.</p>' +
        '<p style="margin-top:20px"><button class="cta" id="start">Start placement</button></p>'
      );
      var b = this.root.getElementById('start');
      if (b) b.addEventListener('click', () => this.begin());
    }

    begin() {
      this.i = 0; this.correct = 0; this.total = PREVIEW_BANK.length;
      this.renderQ();
    }

    renderQ() {
      var item = PREVIEW_BANK[this.i];
      var pct = Math.round((this.i / this.total) * 100);
      var opts = item.options.map((o, idx) =>
        '<button class="opt" data-idx="' + idx + '">' + o + '</button>').join('');
      this.frame(
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<span class="chip">Question ' + (this.i + 1) + ' of ' + this.total + '</span>' +
        '<div class="q">' + item.q + '</div><div class="opts">' + opts + '</div>'
      );
      var self = this;
      this.root.querySelectorAll('button.opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (parseInt(btn.getAttribute('data-idx'), 10) === item.answer) self.correct++;
          self.i++;
          if (self.i >= self.total) self.finish(); else self.renderQ();
        });
      });
    }

    finish() {
      var ratio = this.correct / this.total;
      var scaled = Math.round(40 + ratio * 90);          // 40..130, matches the platform scale
      var band = ratio >= 0.8 ? 'Working above expectation'
              : ratio >= 0.5 ? 'At expected level'
              : 'Building foundations';
      this.frame(
        '<div class="ring"><div class="score">' + scaled + '</div><div class="band">' + band + '</div></div>' +
        '<p class="meta" style="text-align:center">' + this.correct + ' of ' + this.total + ' correct.</p>' +
        '<p class="note">Preview build. Once the wix-embed and anticheat lanes land, items and marking come from the server (keys never reach the browser) and this result saves to your learning record in Lark, then shows on your dashboard.</p>'
      );
    }
  }

  customElements.define('pr-placement', PrPlacement);
})();

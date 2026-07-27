/*
 * pr-capstone: Purple Ruler story-driven capstone mission, as a Wix Custom Element.
 * Embed: Wix Editor > Add > Embed Code > Custom Element > Server URL = the GitHub Pages
 *        URL of this file, Tag Name = pr-capstone.
 *
 * Attributes:
 *   member-token   a Velo-signed {email,name,iat} token (set by the Wix page). Ties every
 *                  answer to the student's account; sent on every API call so the server can
 *                  record the attempt to Lark under the right learner. Optional in DEMO.
 *   mission        mission id. If absent, the element asks the server for the student's
 *                  assigned/next mission. The literal value "DEMO" forces the offline demo.
 *   subject        default "maths".
 *   api            backend base, default "https://test.purpleruler.com".
 *
 * Anti-cheat (the whole point of the design): in LIVE mode the client bundle and every
 * network payload contain ZERO answers, ZERO marking expressions and ZERO reveal text ahead
 * of time. Stems, options, hints and reveals arrive only from /api/capstone/mission; grading
 * happens only on the server (POST /answer, POST /finale). Reveal text for a key is shown
 * only after the server confirms that key is solved.
 *
 * DEMO mode: when no member-token is supplied (or mission="DEMO"), the element runs one
 * small, clearly-labelled, INVENTED demo mission entirely client-side, purely so the Wix
 * embed pipeline (GitHub Pages -> Custom Element -> render) is demonstrable before the
 * backend lands. The demo mission is NOT one of the 55 QA-passed bank missions; its content
 * lives in DEMO_MISSION below and is never used, referenced or reachable in LIVE mode.
 */
(function () {
  if (customElements.get('pr-capstone')) return;

  /* --------------------------------------------------------------------- *
   * INVENTED demo mission (reachable ONLY when demo === true).            *
   * Not from the 55-mission bank. Answers live here solely for the        *
   * offline demo's client-side grading; LIVE mode never reads this block. *
   * --------------------------------------------------------------------- */
  var DEMO_MISSION = {
    id: 'DEMO',
    title: 'The Case of the Missing Meridian',
    premise:
      'A demo mystery. The town clock has frozen at 4:00 and only the numbers can restart it. ' +
      'Crack every key to expose what really jammed the mechanism.',
    cast: 'You (the investigator), Old Tam the clockkeeper, the Mayor.',
    keys: [
      {
        keyId: 'k1', topic: 'Ratio',
        scene: 'Old Tam mixed the gear oil in the wrong ratio and the cogs seized.',
        stem: 'Tam should mix oil to solvent in the ratio 3 : 5. For 40 ml of mixture, how many ml of oil?',
        answerType: 'number', units: 'ml',
        reveal: 'Correct oil = 15 ml. Tam had poured 25 ml, far too thick. Key 1 unlocked.',
        _answer: '15'
      },
      {
        keyId: 'k2', topic: 'Linear equations',
        scene: 'The counterweight fell when a rope of unknown length snapped.',
        stem: 'The rope length L satisfies 2L + 7 = 33 (metres). Find L.',
        answerType: 'number', units: 'm',
        reveal: 'L = 13 m. That rope was frayed at the 13-metre mark. Key 2 unlocked.',
        _answer: '13'
      },
      {
        keyId: 'k3', topic: 'Percentages',
        scene: 'The Mayor claims the spring lost exactly a fifth of its tension.',
        stem: 'A spring rated 250 N loses 20% of its tension. What is the remaining tension?',
        answerType: 'choice', options: ['200 N', '230 N', '50 N', '270 N'],
        reveal: 'Remaining = 200 N. The Mayor was right for once. Key 3 unlocked.',
        _answer: '200 N'
      }
    ],
    finale: {
      prompt: 'Name what jammed the clock and who is responsible.',
      fields: [
        { label: 'Cause', options: ['Wrong oil ratio', 'Snapped rope', 'Lost spring tension'] },
        { label: 'Responsible', options: ['Old Tam', 'The Mayor', 'Nobody, just wear and tear'] }
      ]
    },
    _finaleAnswer: { Cause: 'Wrong oil ratio', Responsible: 'Old Tam' }
  };

  var CSS = [
    ':host{ all: initial; display:block; }',
    '*{ box-sizing:border-box; font-family: "Sora","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }',
    '.wrap{ max-width:720px; margin:0 auto; border-radius:18px; overflow:hidden; box-shadow:0 10px 40px rgba(40,10,80,.14); background:#fff; color:#241a33; }',
    '.hd{ background:linear-gradient(90deg,#5b2a9d,#7a4fc0); color:#fff; padding:22px 26px; }',
    '.hd h2{ margin:0; font-size:21px; letter-spacing:.2px; }',
    '.hd p{ margin:6px 0 0; opacity:.85; font-size:13px; }',
    '.demoflag{ display:inline-block; margin:10px 26px 0; font-size:11px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; color:#8a5a00; background:#fff3d6; border:1px solid #ffd98a; padding:4px 10px; border-radius:8px; }',
    '.bd{ padding:26px; }',
    '.chip{ display:inline-block; font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px; background:#efe8fb; color:#5b2a9d; margin-bottom:14px; letter-spacing:.4px; text-transform:uppercase; }',
    '.premise{ font-size:16px; line-height:1.55; color:#3a3350; margin:4px 0 18px; }',
    '.cast{ font-size:13px; color:#6b6280; margin:0 0 20px; }',
    '.scene{ font-size:16px; line-height:1.6; color:#3a3350; margin:6px 0 16px; font-style:italic; }',
    '.stem{ font-size:19px; font-weight:600; line-height:1.4; margin:6px 0 18px; }',
    '.fig{ max-width:100%; border-radius:12px; margin:0 0 16px; border:1px solid #eee6f7; }',
    '.board{ display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; margin:14px 0 22px; }',
    '.card{ border:1.5px solid #e6def5; border-radius:12px; padding:14px; background:#fbf9ff; }',
    '.card.solved{ border-color:#7a4fc0; background:#f3ecff; }',
    '.card .kt{ font-size:14px; font-weight:600; }',
    '.card .ks{ font-size:12px; margin-top:6px; color:#6b6280; }',
    '.card.solved .ks{ color:#5b2a9d; font-weight:600; }',
    '.opts{ display:grid; gap:10px; }',
    'button.opt{ text-align:left; padding:14px 16px; border:1.5px solid #e6def5; border-radius:12px; background:#fbf9ff; font-size:15px; cursor:pointer; transition:.12s; color:#241a33; }',
    'button.opt:hover{ border-color:#7a4fc0; transform:translateY(-1px); }',
    'button.opt[aria-pressed="true"]{ border-color:#5b2a9d; background:#efe8fb; }',
    'button.opt:focus-visible{ outline:3px solid #b79ee6; outline-offset:2px; }',
    '.numrow{ display:flex; gap:10px; align-items:center; }',
    'input.num{ flex:1; padding:14px 16px; border:1.5px solid #e6def5; border-radius:12px; font-size:16px; color:#241a33; background:#fbf9ff; }',
    'input.num:focus-visible{ outline:3px solid #b79ee6; outline-offset:2px; border-color:#7a4fc0; }',
    '.units{ font-size:15px; color:#6b6280; }',
    'select.fld{ width:100%; padding:13px 14px; border:1.5px solid #e6def5; border-radius:12px; font-size:15px; background:#fbf9ff; color:#241a33; margin-top:6px; }',
    'select.fld:focus-visible{ outline:3px solid #b79ee6; outline-offset:2px; }',
    'label.fldlab{ display:block; font-size:13px; font-weight:600; color:#4a4160; margin-top:14px; }',
    '.cta{ display:inline-block; background:linear-gradient(90deg,#5b2a9d,#7a4fc0); color:#fff; border:0; padding:14px 26px; border-radius:12px; font-size:15px; font-weight:600; cursor:pointer; }',
    '.cta[disabled]{ opacity:.5; cursor:default; }',
    '.cta:focus-visible{ outline:3px solid #b79ee6; outline-offset:2px; }',
    '.ghost{ background:none; border:1.5px solid #e6def5; color:#5b2a9d; padding:12px 20px; border-radius:12px; font-size:14px; font-weight:600; cursor:pointer; }',
    '.ghost:focus-visible{ outline:3px solid #b79ee6; outline-offset:2px; }',
    '.row{ display:flex; gap:12px; align-items:center; margin-top:20px; flex-wrap:wrap; }',
    '.bar{ height:7px; background:#eee6f7; border-radius:99px; margin-bottom:20px; overflow:hidden; }',
    '.bar > i{ display:block; height:100%; background:linear-gradient(90deg,#5b2a9d,#7a4fc0); width:0; transition:width .3s; }',
    '.feedback{ margin-top:16px; font-size:15px; font-weight:600; min-height:22px; }',
    '.feedback.ok{ color:#2c7a4b; }',
    '.feedback.no{ color:#b23b52; }',
    '.reveal{ margin-top:14px; padding:14px 16px; border-radius:12px; background:#f3ecff; border:1px solid #d9c6f5; font-size:15px; line-height:1.5; color:#3a3350; }',
    '.hint{ margin-top:14px; padding:12px 16px; border-radius:12px; background:#fffaf0; border:1px solid #ffe6b0; font-size:14px; line-height:1.5; color:#6b5a2a; }',
    '.meta{ font-size:13px; color:#6b6280; margin-top:16px; }',
    '.ring{ text-align:center; padding:8px 0 4px; }',
    '.verdict{ font-size:30px; font-weight:700; color:#5b2a9d; }',
    '.band{ font-size:15px; color:#4a4160; margin-top:6px; }',
    '.note{ font-size:12px; color:#9089a6; margin-top:18px; border-top:1px solid #efeaf7; padding-top:12px; line-height:1.5; }',
    '.spinner{ text-align:center; color:#6b6280; font-size:15px; padding:20px 0; }'
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

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  class PrCapstone extends HTMLElement {
    connectedCallback() {
      this.subject = this.getAttribute('subject') || 'maths';
      this.api = (this.getAttribute('api') || 'https://test.purpleruler.com').replace(/\/+$/, '');
      this.token = this.getAttribute('member-token') || '';
      this.missionId = this.getAttribute('mission') || '';
      this.name = decodeName(this.token);
      // Demo when there is no signed-in member, or the page explicitly asks for DEMO.
      this.demo = !this.token || this.missionId.toUpperCase() === 'DEMO';
      this.root = this.attachShadow({ mode: 'open' });
      this.style_ = '<style>' + CSS + '</style>';
      this.solved = {};   // keyId -> true
      this.reveals = {};  // keyId -> earned reveal text (only after server/demo confirms solved)
      if (this.demo) {
        this.loadDemo();
      } else {
        this.loadMission();
      }
    }

    /* ---------- frame + small helpers ---------- */
    frame(inner, opts) {
      opts = opts || {};
      var subtitle = this.name ? ('Signed in as ' + esc(this.name))
        : (this.demo ? 'Demo mode (no member signed in)' : 'Not signed in');
      var flag = this.demo ? '<div class="demoflag">Demo mission &middot; not from the real bank</div>' : '';
      var title = (this.mission && this.mission.title) ? esc(this.mission.title) : 'Capstone mission';
      this.root.innerHTML = this.style_ +
        '<div class="wrap"><div class="hd"><h2>' + title + '</h2><p>' + subtitle + '</p></div>' +
        flag +
        '<div class="bd">' + inner + '</div></div>';
    }

    $(sel) { return this.root.querySelector(sel); }
    $$(sel) { return this.root.querySelectorAll(sel); }

    /* ---------- networking (LIVE mode only) ---------- */
    headers() {
      var h = { 'Content-Type': 'application/json' };
      if (this.token) {
        h['Authorization'] = 'Bearer ' + this.token; // ties every call to the member account
        h['X-Member-Token'] = this.token;
      }
      return h;
    }

    async loadMission() {
      this.renderLoading('Loading your mission…');
      var url = this.api + '/api/capstone/mission?subject=' + encodeURIComponent(this.subject) +
        (this.missionId ? '&mission=' + encodeURIComponent(this.missionId) : '');
      try {
        var res = await fetch(url, { method: 'GET', headers: this.headers() });
        if (!this.handleStatus(res)) return;
        var data = await res.json();
        this.ingestMission(data);
        this.renderBriefing();
      } catch (e) {
        this.renderError('We could not reach the mission server. Please check your connection and try again.', () => this.loadMission());
      }
    }

    // Accepts the reader.json contract. Server owns solved-state + earned reveals.
    ingestMission(data) {
      data = data || {};
      this.mission = {
        id: data.id || this.missionId || '',
        title: data.title || 'Capstone mission',
        premise: data.premise || '',
        cast: data.cast || '',
        keys: Array.isArray(data.keys) ? data.keys : [],
        finale: data.finale || null
      };
      // Server-declared progress (resume): which keys are already solved + earned reveals.
      (this.mission.keys || []).forEach((k) => {
        if (k.solved) this.solved[k.keyId] = true;
        if (k.reveal) this.reveals[k.keyId] = k.reveal; // server only sends reveal for solved keys
      });
      if (Array.isArray(data.solved)) data.solved.forEach((id) => { this.solved[id] = true; });
    }

    handleStatus(res) {
      if (res.ok) return true;
      if (res.status === 401 || res.status === 403) {
        this.renderNotEnrolled();
      } else if (res.status === 503) {
        this.renderError('The mission server is busy right now. Please try again in a moment.', () => this.loadMission());
      } else {
        this.renderError('Something went wrong (error ' + res.status + '). Please try again.', () => this.loadMission());
      }
      return false;
    }

    /* ---------- generic screens ---------- */
    renderLoading(msg) {
      this.mission = this.mission || null;
      this.frame('<div class="spinner">' + esc(msg || 'Loading…') + '</div>');
    }

    renderError(msg, retry) {
      this.frame(
        '<span class="chip">Hold on</span>' +
        '<div class="stem">' + esc(msg) + '</div>' +
        '<div class="row"><button class="cta" id="retry">Try again</button></div>'
      );
      var b = this.$('#retry');
      if (b && retry) b.addEventListener('click', retry);
    }

    renderNotEnrolled() {
      this.frame(
        '<span class="chip">Access</span>' +
        '<div class="stem">You are not enrolled on this capstone yet.</div>' +
        '<p class="meta">If you think this is a mistake, ask your teacher or contact Purple Ruler support and we will get you set up.</p>'
      );
    }

    /* ---------- demo loader ---------- */
    loadDemo() {
      // Deep-ish copy so demo answers can be stripped from what render touches.
      this.mission = {
        id: DEMO_MISSION.id,
        title: DEMO_MISSION.title,
        premise: DEMO_MISSION.premise,
        cast: DEMO_MISSION.cast,
        keys: DEMO_MISSION.keys,
        finale: DEMO_MISSION.finale
      };
      this.renderBriefing();
    }

    /* ---------- briefing ---------- */
    renderBriefing() {
      var keys = this.mission.keys || [];
      var solvedCount = keys.filter((k) => this.solved[k.keyId]).length;
      var board = keys.map((k, i) => {
        var done = !!this.solved[k.keyId];
        return '<div class="card' + (done ? ' solved' : '') + '">' +
          '<div class="kt">Key ' + (i + 1) + '</div>' +
          '<div class="ks">' + (done ? 'Solved &check;' : (esc(k.topic || 'Locked'))) + '</div></div>';
      }).join('');
      var cta = solvedCount >= keys.length && keys.length > 0
        ? 'Go to the finale'
        : (solvedCount > 0 ? 'Continue the case' : 'Start the case');
      this.frame(
        '<span class="chip">' + keys.length + ' keys &middot; ' + solvedCount + ' solved</span>' +
        (this.mission.premise ? '<div class="premise">' + esc(this.mission.premise) + '</div>' : '') +
        (this.mission.cast ? '<p class="cast">Cast: ' + esc(this.mission.cast) + '</p>' : '') +
        '<div class="board">' + board + '</div>' +
        '<div class="row"><button class="cta" id="go">' + cta + '</button></div>'
      );
      var b = this.$('#go');
      if (b) b.addEventListener('click', () => this.advance());
    }

    // Move to the first unsolved key, or the finale if all solved.
    advance() {
      var keys = this.mission.keys || [];
      for (var i = 0; i < keys.length; i++) {
        if (!this.solved[keys[i].keyId]) { this.renderKey(i); return; }
      }
      this.renderFinale();
    }

    /* ---------- key screen ---------- */
    renderKey(idx) {
      var keys = this.mission.keys || [];
      var key = keys[idx];
      if (!key) { this.advance(); return; }
      this.curIdx = idx;
      this.selectedChoice = null;

      var solvedCount = keys.filter((k) => this.solved[k.keyId]).length;
      var pct = Math.round((solvedCount / keys.length) * 100);

      // Input area: depends on answerType. Stem/options come ONLY from the mission payload.
      var input;
      if (key.answerType === 'choice' && Array.isArray(key.options)) {
        input = '<div class="opts">' + key.options.map((o, i) =>
          '<button class="opt" data-val="' + esc(o) + '" aria-pressed="false">' + esc(o) + '</button>'
        ).join('') + '</div>';
      } else {
        input = '<div class="numrow"><input class="num" id="ans" type="text" inputmode="decimal" ' +
          'autocomplete="off" aria-label="Your answer" placeholder="Your answer">' +
          (key.units ? '<span class="units">' + esc(key.units) + '</span>' : '') + '</div>';
      }

      // Render stem ONLY if the server supplied it (Kahoot mode may withhold it).
      var stemHtml = key.stem ? '<div class="stem">' + esc(key.stem) + '</div>'
        : '<div class="stem">Answer on your device. Read the question shown to you.</div>';
      var figHtml = key.fig ? '<img class="fig" alt="Figure for this key" src="' + esc(key.fig) + '">' : '';

      this.frame(
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<span class="chip">Key ' + (idx + 1) + ' of ' + keys.length +
        (key.topic ? ' &middot; ' + esc(key.topic) : '') + '</span>' +
        (key.scene ? '<div class="scene">' + esc(key.scene) + '</div>' : '') +
        stemHtml + figHtml + input +
        '<div class="feedback" id="fb" aria-live="polite"></div>' +
        '<div id="revealslot"></div>' +
        '<div class="row">' +
        (key.hint ? '<button class="ghost" id="hint">Show a hint</button>' : '') +
        '<button class="cta" id="submit">Submit answer</button>' +
        '</div>'
      );

      var self = this;
      this.$$('button.opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.$$('button.opt').forEach((b) => b.setAttribute('aria-pressed', 'false'));
          btn.setAttribute('aria-pressed', 'true');
          self.selectedChoice = btn.getAttribute('data-val');
        });
      });
      var hintBtn = this.$('#hint');
      if (hintBtn) hintBtn.addEventListener('click', () => {
        var slot = self.$('#revealslot');
        if (slot && key.hint) slot.innerHTML = '<div class="hint">' + esc(key.hint) + '</div>';
      });
      this.$('#submit').addEventListener('click', () => this.submitKey(key, idx));
    }

    readAnswer(key) {
      if (key.answerType === 'choice') return this.selectedChoice;
      var el = this.$('#ans');
      return el ? el.value.trim() : '';
    }

    setFeedback(msg, cls) {
      var fb = this.$('#fb');
      if (fb) { fb.textContent = msg; fb.className = 'feedback ' + (cls || ''); }
    }

    async submitKey(key, idx) {
      var answer = this.readAnswer(key);
      if (answer == null || answer === '') { this.setFeedback('Choose or type an answer first.', 'no'); return; }
      var btn = this.$('#submit');
      if (btn) btn.setAttribute('disabled', 'disabled');

      var result;
      if (this.demo) {
        result = this.gradeDemo(key, answer);
      } else {
        result = await this.gradeLive(key, answer);
        if (result === null) { if (btn) btn.removeAttribute('disabled'); return; } // error already rendered
      }

      if (result.correct) {
        this.solved[key.keyId] = true;
        if (result.reveal) this.reveals[key.keyId] = result.reveal;
        this.setFeedback('Correct. Key unlocked.', 'ok');
        var slot = this.$('#revealslot');
        if (slot && this.reveals[key.keyId]) {
          slot.innerHTML = '<div class="reveal">' + esc(this.reveals[key.keyId]) + '</div>';
        }
        if (btn) { btn.textContent = 'Next'; btn.removeAttribute('disabled'); }
        var self = this;
        var next = this.$('#submit').cloneNode(true); // drop old listeners
        this.$('#submit').parentNode.replaceChild(next, this.$('#submit'));
        next.addEventListener('click', () => self.advance());
      } else {
        this.setFeedback(result.message || 'Not quite, try again.', 'no');
        if (btn) btn.removeAttribute('disabled');
      }
    }

    async gradeLive(key, answer) {
      try {
        var res = await fetch(this.api + '/api/capstone/answer', {
          method: 'POST', headers: this.headers(),
          body: JSON.stringify({ mission: this.mission.id, keyId: key.keyId, answer: answer })
        });
        if (!this.handleStatus(res)) return null;
        var data = await res.json();
        return { correct: !!data.correct, reveal: data.reveal, message: data.message };
      } catch (e) {
        this.setFeedback('Could not reach the server. Please try again.', 'no');
        return null;
      }
    }

    // DEMO grading only, never runs in LIVE mode.
    gradeDemo(key, answer) {
      var want = String(key._answer == null ? '' : key._answer).trim().toLowerCase();
      var got = String(answer).trim().toLowerCase();
      var ok = got === want || got.replace(/\s+/g, '') === want.replace(/\s+/g, '');
      return { correct: ok, reveal: ok ? key.reveal : null, message: ok ? '' : 'Not quite, try again.' };
    }

    /* ---------- finale ---------- */
    renderFinale() {
      var fin = this.mission.finale;
      if (!fin) { this.renderClosed({ verdict: 'Case closed', message: 'Every key is solved.' }); return; }
      var fields = (fin.fields || []).map((f, i) =>
        '<label class="fldlab" for="fld' + i + '">' + esc(f.label) + '</label>' +
        '<select class="fld" id="fld' + i + '" data-label="' + esc(f.label) + '">' +
        '<option value="">Choose…</option>' +
        (f.options || []).map((o) => '<option value="' + esc(o) + '">' + esc(o) + '</option>').join('') +
        '</select>'
      ).join('');
      this.frame(
        '<span class="chip">Finale</span>' +
        '<div class="stem">' + esc(fin.prompt || 'Make your final deduction.') + '</div>' +
        fields +
        '<div class="feedback" id="fb" aria-live="polite"></div>' +
        '<div class="row"><button class="cta" id="verdict">Submit verdict</button></div>'
      );
      this.$('#verdict').addEventListener('click', () => this.submitFinale());
    }

    collectVerdict() {
      var v = {};
      this.$$('select.fld').forEach((s) => { v[s.getAttribute('data-label')] = s.value; });
      return v;
    }

    async submitFinale() {
      var verdict = this.collectVerdict();
      var missingAny = Object.keys(verdict).some((k) => !verdict[k]);
      if (missingAny) { this.setFeedback('Make a choice for each field.', 'no'); return; }
      var btn = this.$('#verdict');
      if (btn) btn.setAttribute('disabled', 'disabled');

      var result;
      if (this.demo) {
        result = this.gradeDemoFinale(verdict);
      } else {
        try {
          var res = await fetch(this.api + '/api/capstone/finale', {
            method: 'POST', headers: this.headers(),
            body: JSON.stringify({ mission: this.mission.id, verdict: verdict })
          });
          if (!this.handleStatus(res)) return;
          result = await res.json();
        } catch (e) {
          this.setFeedback('Could not reach the server. Please try again.', 'no');
          if (btn) btn.removeAttribute('disabled');
          return;
        }
      }
      this.renderClosed(result);
    }

    // DEMO finale grading only.
    gradeDemoFinale(verdict) {
      var want = DEMO_MISSION._finaleAnswer;
      var ok = Object.keys(want).every((k) => String(verdict[k]) === String(want[k]));
      return {
        correct: ok,
        verdict: ok ? 'Case solved!' : 'Case not yet solved',
        message: ok
          ? 'You named the wrong oil ratio and Old Tam. The clock ticks again.'
          : 'Your deduction does not fit the evidence. Revisit the keys and try the verdict again.'
      };
    }

    /* ---------- case closed ---------- */
    renderClosed(result) {
      result = result || {};
      var keys = this.mission.keys || [];
      var solvedCount = keys.filter((k) => this.solved[k.keyId]).length;
      var verdict = result.verdict || (result.correct ? 'Case solved!' : 'Case closed');
      var band = result.message || (result.correct ? 'Well deduced.' : 'Give it another look.');
      var note = this.demo
        ? 'Demo build. Once the /api/capstone/* endpoints land, missions, grading and reveals come from the server (keys never reach the browser) and this attempt saves to your learning record in Lark (WB-Test-Attempt), then shows on your dashboard.'
        : 'Your attempt has been recorded to your learning record.';
      var retry = (this.demo && !result.correct)
        ? '<div class="row"><button class="ghost" id="again">Back to the case board</button></div>'
        : '';
      this.frame(
        '<div class="ring"><div class="verdict">' + esc(verdict) + '</div>' +
        '<div class="band">' + esc(band) + '</div></div>' +
        '<p class="meta" style="text-align:center">' + solvedCount + ' of ' + keys.length + ' keys solved.</p>' +
        retry +
        '<p class="note">' + esc(note) + '</p>'
      );
      var again = this.$('#again');
      if (again) again.addEventListener('click', () => this.renderBriefing());
    }
  }

  customElements.define('pr-capstone', PrCapstone);
})();

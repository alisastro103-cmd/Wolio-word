(function(){
  "use strict";

  /* ============================================================
     1) MARKDOWN PARSER — vanilla JS, tanpa library eksternal.
        Mendukung: heading, bold/italic/strikethrough, inline code,
        blok kode berpagar (dengan label bahasa), list (ordered /
        unordered / task list), blockquote (termasuk nested),
        tabel, horizontal rule, link, gambar, line break.
     ============================================================ */

  function escapeHtml(str){
    return str
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;");
  }

  /* ============================================================
     1b) SYNTAX HIGHLIGHTER — vanilla JS, tanpa library eksternal.
         Tokenizer regex ringan bergaya VS Code untuk blok kode
         berpagar (```lang). Mendukung: javascript/typescript,
         python, bash/shell, json, css, html, dan grammar "clike"
         generik untuk bahasa mirip C (java/c/cpp/go/rust/php/dst).
         Bahasa yang tidak dikenali ditampilkan polos (tanpa warna).
     ============================================================ */

  var LANG_ALIASES = {
    javascript:"javascript", js:"javascript", jsx:"javascript", mjs:"javascript", cjs:"javascript",
    ts:"javascript", tsx:"javascript", typescript:"javascript",
    python:"python", py:"python", py3:"python",
    bash:"bash", sh:"bash", shell:"bash", zsh:"bash",
    json:"json", jsonc:"json",
    css:"css", scss:"css", less:"css",
    html:"html", htm:"html", xml:"html", svg:"html",
    java:"clike", c:"clike", cpp:"clike", "c++":"clike", cs:"clike", csharp:"clike",
    go:"clike", golang:"clike", rust:"clike", rs:"clike", php:"clike",
    ruby:"clike", rb:"clike", swift:"clike", kotlin:"clike", kt:"clike"
  };

  function normalizeLang(lang){
    if (!lang) return null;
    var key = lang.toLowerCase().trim();
    return LANG_ALIASES[key] || null;
  }

  var STR_PATTERN = "\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'|`(?:\\\\.|[^`\\\\])*`";
  var NUM_PATTERN = "\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b";

  var GRAMMARS = {
    javascript: [
      { type:"comment", src:"\\/\\/[^\\n]*" },
      { type:"comment", src:"\\/\\*[\\s\\S]*?\\*\\/" },
      { type:"string", src:STR_PATTERN },
      { type:"number", src:NUM_PATTERN },
      { type:"keyword", src:"\\b(?:var|let|const|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|this|import|from|export|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|void|yield|static|get|set|delete|interface|type|implements|as|enum|public|private|protected|readonly)\\b" },
      { type:"boolean", src:"\\b(?:true|false|null|undefined|NaN)\\b" },
      { type:"function", src:"\\b[A-Za-z_$][\\w$]*(?=\\s*\\()" },
      { type:"class", src:"\\b[A-Z][\\w$]*\\b" }
    ],
    python: [
      { type:"comment", src:"#[^\\n]*" },
      { type:"string", src:'"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|' + STR_PATTERN },
      { type:"number", src:NUM_PATTERN },
      { type:"keyword", src:"\\b(?:def|return|if|elif|else|for|while|in|not|and|or|import|from|as|class|try|except|finally|raise|with|lambda|yield|pass|break|continue|global|nonlocal|is|async|await|del)\\b" },
      { type:"boolean", src:"\\b(?:None|True|False|self)\\b" },
      { type:"function", src:"\\b[A-Za-z_]\\w*(?=\\s*\\()" },
      { type:"class", src:"\\b[A-Z]\\w*\\b" }
    ],
    bash: [
      { type:"comment", src:"#[^\\n]*" },
      { type:"string", src:STR_PATTERN },
      { type:"variable", src:"\\$\\{?[\\w#@*?-]+\\}?" },
      { type:"keyword", src:"\\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|return|local|export|echo|exit|in)\\b" },
      { type:"number", src:NUM_PATTERN }
    ],
    json: [
      { type:"key", src:"\"(?:\\\\.|[^\"\\\\])*\"(?=\\s*:)" },
      { type:"string", src:"\"(?:\\\\.|[^\"\\\\])*\"" },
      { type:"number", src:NUM_PATTERN },
      { type:"boolean", src:"\\b(?:true|false|null)\\b" }
    ],
    css: [
      { type:"comment", src:"\\/\\*[\\s\\S]*?\\*\\/" },
      { type:"string", src:STR_PATTERN },
      { type:"keyword", src:"@[\\w-]+" },
      { type:"number", src:"#[0-9a-fA-F]{3,8}\\b" },
      { type:"property", src:"[\\w-]+(?=\\s*:)" },
      { type:"number", src:"\\b\\d+(?:\\.\\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\\b" }
    ],
    html: [
      { type:"comment", src:"<!--[\\s\\S]*?-->" },
      { type:"tag", src:"<\\/?[A-Za-z][\\w-]*" },
      { type:"attr", src:"[A-Za-z_:][\\w:.-]*(?=\\s*=)" },
      { type:"string", src:"\"[^\"]*\"|'[^']*'" }
    ],
    clike: [
      { type:"comment", src:"\\/\\/[^\\n]*" },
      { type:"comment", src:"\\/\\*[\\s\\S]*?\\*\\/" },
      { type:"string", src:STR_PATTERN },
      { type:"number", src:NUM_PATTERN },
      { type:"keyword", src:"\\b(?:public|private|protected|static|final|void|int|long|float|double|char|boolean|string|String|class|interface|extends|implements|new|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|throws|import|package|namespace|using|struct|enum|func|fn|let|const|var|def|end|module|require|include|typedef|template|virtual|override|null|nil|true|false|self|this)\\b" },
      { type:"function", src:"\\b[A-Za-z_]\\w*(?=\\s*\\()" },
      { type:"class", src:"\\b[A-Z]\\w*\\b" }
    ]
  };

  function tokenize(code, patterns){
    var combined = new RegExp(patterns.map(function(p){ return "(" + p.src + ")"; }).join("|"), "g");
    var out = "";
    var lastIndex = 0;
    var match;
    while ((match = combined.exec(code)) !== null){
      if (match.index > lastIndex){
        out += escapeHtml(code.slice(lastIndex, match.index));
      }
      var groupIdx = -1;
      for (var i = 1; i < match.length; i++){
        if (match[i] !== undefined){ groupIdx = i - 1; break; }
      }
      var type = groupIdx >= 0 ? patterns[groupIdx].type : null;
      var text = match[0];
      out += type ? '<span class="tok-' + type + '">' + escapeHtml(text) + "</span>" : escapeHtml(text);
      lastIndex = combined.lastIndex;
      if (match[0].length === 0){ combined.lastIndex++; }
    }
    out += escapeHtml(code.slice(lastIndex));
    return out;
  }

  function highlightCode(code, lang){
    var grammarKey = normalizeLang(lang);
    var grammar = grammarKey ? GRAMMARS[grammarKey] : null;
    return grammar ? tokenize(code, grammar) : escapeHtml(code);
  }

  var COPY_ICON = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>';
  var CHECK_ICON = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>';

  // Inline-level rendering: code spans harus diproses lebih dulu lalu
  // konten lain di-escape, supaya markup mentah pengguna tidak dieksekusi.
  function renderInline(text){
    // Lindungi inline code dulu (isi kode tidak boleh diproses lebih lanjut)
    var codeStore = [];
    text = text.replace(/`([^`]+)`/g, function(_, code){
      codeStore.push(escapeHtml(code));
      return "\u0000CODE" + (codeStore.length - 1) + "\u0000";
    });

    // Escape sisanya
    text = escapeHtml(text);

    // Gambar ![alt](src "title")
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      function(_, alt, src, title){
        return '<img alt="' + alt + '" src="' + src + '"' + (title ? ' title="' + title + '"' : '') + '>';
      });

    // Link [text](href "title")
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      function(_, label, href, title){
        var safeHref = /^(javascript:|data:text\/html)/i.test(href) ? "#" : href;
        return '<a href="' + safeHref + '"' + (title ? ' title="' + title + '"' : '') +
               (/^https?:\/\//i.test(safeHref) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + label + '</a>';
      });

    // Bold + italic ***text*** atau ___text___
    text = text.replace(/(\*\*\*|___)(.+?)\1/g, "<strong><em>$2</em></strong>");
    // Bold **text** atau __text__
    text = text.replace(/(\*\*|__)(.+?)\1/g, "<strong>$2</strong>");
    // Italic *text* atau _text_
    text = text.replace(/(\*|_)([^\s*_][^*_]*?)\1/g, "<em>$2</em>");
    // Strikethrough ~~text~~
    text = text.replace(/~~(.+?)~~/g, "<del>$1</del>");
    // Keyboard <kbd>
    text = text.replace(/&lt;kbd&gt;(.+?)&lt;\/kbd&gt;/g, "<kbd>$1</kbd>");

    // Line break ganda spasi di akhir baris -> <br>
    text = text.replace(/ {2,}\n/g, "<br>\n");

    // Kembalikan inline code
    text = text.replace(/\u0000CODE(\d+)\u0000/g, function(_, i){
      return "<code>" + codeStore[i] + "</code>";
    });

    return text;
  }

  function renderMarkdown(src){
    if (!src || !src.trim()){
      return '<p class="empty-hint">Belum ada konten. Tulis Markdown di panel editor untuk melihat pratinjau di sini.</p>';
    }

    // Normalisasi line ending
    src = src.replace(/\r\n?/g, "\n");

    // --- 1. Ekstrak blok kode berpagar ``` agar isinya tidak diproses sebagai markdown ---
    var fencedBlocks = [];
    src = src.replace(/^ {0,3}(```|~~~)([^\n`]*)\n([\s\S]*?)\n {0,3}\1[ \t]*$/gm,
      function(_, fence, lang, code){
        fencedBlocks.push({ lang: lang.trim(), code: code });
        return "\u0000FENCE" + (fencedBlocks.length - 1) + "\u0000";
      });

    var lines = src.split("\n");
    var html = [];
    var i = 0;

    function isBlank(l){ return /^\s*$/.test(l); }

    while (i < lines.length){
      var line = lines[i];

      // Placeholder blok kode
      var fenceMatch = line.match(/^\u0000FENCE(\d+)\u0000$/);
      if (fenceMatch){
        var block = fencedBlocks[parseInt(fenceMatch[1], 10)];
        if (/^mermaid$/i.test(block.lang)){
          html.push('<div class="mermaid-block"><div class="mermaid">' + escapeHtml(block.code) + '</div></div>');
          i++;
          continue;
        }
        var langLabel = block.lang ? '<span class="lang-tag">' + escapeHtml(block.lang) + '</span>' : "";
        var copyBtn = '<button type="button" class="copy-btn" data-copy-icon title="Salin kode">' + COPY_ICON + '</button>';
        var toolbar = '<div class="code-toolbar">' + langLabel + copyBtn + '</div>';
        var highlighted = highlightCode(block.code, block.lang);
        html.push('<div class="code-block">' + toolbar + '<pre data-code="' + escapeHtml(block.code) + '"><code>' + highlighted + '</code></pre></div>');
        i++;
        continue;
      }

      // Blank line
      if (isBlank(line)){ i++; continue; }

      // Horizontal rule
      if (/^ {0,3}([-*_])( *\1){2,} *$/.test(line)){
        html.push("<hr>");
        i++;
        continue;
      }

      // Heading
      var h = line.match(/^ {0,3}(#{1,6}) +(.*?) *#*$/);
      if (h){
        var level = h[1].length;
        html.push("<h" + level + ">" + renderInline(h[2]) + "</h" + level + ">");
        i++;
        continue;
      }

      // Blockquote (kumpulkan baris berturut-turut yang diawali '>')
      if (/^ {0,3}>/.test(line)){
        var quoteLines = [];
        while (i < lines.length && /^ {0,3}>/.test(lines[i])){
          quoteLines.push(lines[i].replace(/^ {0,3}> ?/, ""));
          i++;
        }
        html.push("<blockquote>" + renderMarkdown(quoteLines.join("\n")) + "</blockquote>");
        continue;
      }

      // Tabel: baris header | --- | diikuti baris data
      if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*\s*$/.test(lines[i+1]) && /-/.test(lines[i+1])){
        var headerCells = line.trim().replace(/^\||\|$/g, "").split("|").map(function(c){return c.trim();});
        var alignRow = lines[i+1].trim().replace(/^\||\|$/g, "").split("|").map(function(c){return c.trim();});
        var aligns = alignRow.map(function(c){
          var l = /^:/.test(c), r = /:$/.test(c);
          if (l && r) return "center";
          if (r) return "right";
          if (l) return "left";
          return "";
        });
        i += 2;
        var rows = [];
        while (i < lines.length && /\|/.test(lines[i]) && !isBlank(lines[i])){
          rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map(function(c){return c.trim();}));
          i++;
        }
        var thead = "<thead><tr>" + headerCells.map(function(c, idx){
          var style = aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : "";
          return "<th" + style + ">" + renderInline(c) + "</th>";
        }).join("") + "</tr></thead>";
        var tbody = "<tbody>" + rows.map(function(r){
          return "<tr>" + r.map(function(c, idx){
            var style = aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : "";
            return "<td" + style + ">" + renderInline(c) + "</td>";
          }).join("") + "</tr>";
        }).join("") + "</tbody>";
        html.push("<table>" + thead + tbody + "</table>");
        continue;
      }

      // List (unordered / ordered / task), termasuk item yang menyambung multi-baris sederhana
      var ulMatch = line.match(/^( {0,3})([-*+]) +(.*)$/);
      var olMatch = line.match(/^( {0,3})(\d+)[.)] +(.*)$/);
      if (ulMatch || olMatch){
        var ordered = !!olMatch;
        var items = [];
        var re = ordered ? /^( {0,3})(\d+)[.)] +(.*)$/ : /^( {0,3})([-*+]) +(.*)$/;
        while (i < lines.length){
          var m = lines[i].match(re);
          if (!m){
            // baris lanjutan (indented, bukan blank, bukan item baru)
            if (!isBlank(lines[i]) && /^\s+\S/.test(lines[i]) && items.length){
              items[items.length - 1] += " " + lines[i].trim();
              i++;
              continue;
            }
            break;
          }
          items.push(m[3]);
          i++;
        }
        var tag = ordered ? "ol" : "ul";
        var itemsHtml = items.map(function(it){
          var task = it.match(/^\[( |x|X)\]\s+(.*)$/);
          if (task){
            var checked = /x/i.test(task[1]);
            return '<li class="task-list-item"><input type="checkbox" disabled' + (checked ? " checked" : "") + "> " + renderInline(task[2]) + "</li>";
          }
          return "<li>" + renderInline(it) + "</li>";
        }).join("");
        html.push("<" + tag + ">" + itemsHtml + "</" + tag + ">");
        continue;
      }

      // Paragraph (gabungkan baris berturut-turut sampai blank line / blok lain)
      var paraLines = [line];
      i++;
      while (i < lines.length && !isBlank(lines[i]) &&
             !/^ {0,3}(#{1,6}) +/.test(lines[i]) &&
             !/^ {0,3}>/.test(lines[i]) &&
             !/^ {0,3}([-*_])( *\1){2,} *$/.test(lines[i]) &&
             !/^ {0,3}([-*+]) +/.test(lines[i]) &&
             !/^ {0,3}(\d+)[.)] +/.test(lines[i]) &&
             !/^\u0000FENCE\d+\u0000$/.test(lines[i])){
        paraLines.push(lines[i]);
        i++;
      }
      html.push("<p>" + renderInline(paraLines.join("\n")) + "</p>");
    }

    return html.join("\n");
  }

  /* ============================================================
     2) STATE, DOM, DAN LOGIKA APLIKASI
     ============================================================ */

  var editor = document.getElementById("editor");
  var preview = document.getElementById("preview");
  var paneEdit = document.getElementById("paneEdit");
  var panePreview = document.getElementById("panePreview");
  var modeEdit = document.getElementById("modeEdit");
  var modePreview = document.getElementById("modePreview");
  var modeSplit = document.getElementById("modeSplit");
  var themeToggle = document.getElementById("themeToggle");
  var homeBtn = document.getElementById("homeBtn");
  var filenameInput = document.getElementById("filenameInput");
  var fileInput = document.getElementById("fileInput");
  var statusEl = document.getElementById("status");
  var statsEl = document.getElementById("stats");
  var tabStrip = document.getElementById("tabStrip");
  var newTabBtn = document.getElementById("newTabBtn");
  var mainArea = document.getElementById("mainArea");
  var paneResizer = document.getElementById("paneResizer");

  /* ---- Refs: activity bar, files flyout, find/replace, palette, status ---- */
  var sidebarFilesBtn = document.getElementById("sidebarFilesBtn");
  var sidebarOutlineBtn = document.getElementById("sidebarOutlineBtn");
  var outlineFlyout = document.getElementById("outlineFlyout");
  var outlineFlyoutList = document.getElementById("outlineFlyoutList");
  var sidebarSearchBtn = document.getElementById("sidebarSearchBtn");
  var sidebarPaletteBtn = document.getElementById("sidebarPaletteBtn");
  var filesFlyout = document.getElementById("filesFlyout");
  var filesFlyoutList = document.getElementById("filesFlyoutList");
  var historyFlyoutList = document.getElementById("historyFlyoutList");
  var historyCheckpointBtn = document.getElementById("historyCheckpointBtn");
  var findBar = document.getElementById("findBar");
  var findInput = document.getElementById("findInput");
  var replaceInput = document.getElementById("replaceInput");
  var findPrevBtn = document.getElementById("findPrevBtn");
  var findNextBtn = document.getElementById("findNextBtn");
  var findCount = document.getElementById("findCount");
  var replaceOneBtn = document.getElementById("replaceOneBtn");
  var replaceAllBtn = document.getElementById("replaceAllBtn");
  var findCloseBtn = document.getElementById("findCloseBtn");
  var paletteOverlay = document.getElementById("paletteOverlay");
  var paletteInput = document.getElementById("paletteInput");
  var paletteList = document.getElementById("paletteList");
  var cursorPosEl = document.getElementById("cursorPos");
  var modeLabelEl = document.getElementById("modeLabel");

  var DEFAULT_CONTENT =
"# Selamat datang di Wolio Word\n\n" +
"Ini adalah **README.md Viewer & Editor** yang jalan sepenuhnya di browser kamu, tanpa server dan tanpa koneksi internet.\n\n" +
"## Fitur utama\n\n" +
"- Mode **Editor**, **Review**, dan **Split**\n" +
"- Impor file `.md` dari perangkat\n" +
"- Ekspor ke `.md` atau `.html`\n" +
"- Tema terang / gelap\n" +
"- Dukungan tabel, daftar tugas, blok kode, dan kutipan\n\n" +
"```js\n" +
"// Contoh blok kode\n" +
"function halo(nama) {\n" +
"  return `Halo, ${nama}!`;\n" +
"}\n" +
"```\n\n" +
"> Edit teks di panel sebelah kiri, lalu lihat hasilnya di sini secara langsung.\n\n" +
"Baca **PANDUAN.md** yang disertakan dalam proyek ini untuk penjelasan lengkap cara pemakaian.\n";

  var WORDS_PER_MINUTE = 200; // rata-rata kecepatan baca

  function estimateReadingLabel(words){
    if (words === 0) return "0 menit baca";
    var minutes = words / WORDS_PER_MINUTE;
    return (minutes < 1 ? "<1 menit baca" : Math.ceil(minutes) + " menit baca");
  }

  function updateStats(){
    var text = editor.value;
    var lines = text.split("\n").length;
    var words = (text.trim().match(/\S+/g) || []).length;
    var chars = text.length;
    statsEl.textContent = lines + " baris · " + words + " kata · " + chars + " karakter · ~" + estimateReadingLabel(words);
  }

  function setStatus(msg){
    statusEl.textContent = msg;
  }

  function renderPreview(){
    preview.innerHTML = renderMarkdown(editor.value);
    renderMermaidDiagrams(preview);
  }

  /* ---- Diagram Mermaid (dimuat lazy dari CDN, hanya kalau ada blok ```mermaid) ---- */
  var mermaidState = "idle"; // idle | loading | ready | failed
  var mermaidWaiters = [];
  function ensureMermaidLoaded(cb){
    if (mermaidState === "ready"){ cb(true); return; }
    if (mermaidState === "failed"){ cb(false); return; }
    mermaidWaiters.push(cb);
    if (mermaidState === "loading") return;
    mermaidState = "loading";
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
    script.onload = function(){
      mermaidState = "ready";
      try {
        window.mermaid.initialize({ startOnLoad:false, theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default" });
      } catch(e){}
      mermaidWaiters.forEach(function(fn){ fn(true); });
      mermaidWaiters = [];
    };
    script.onerror = function(){
      mermaidState = "failed";
      mermaidWaiters.forEach(function(fn){ fn(false); });
      mermaidWaiters = [];
    };
    document.head.appendChild(script);
  }
  function renderMermaidDiagrams(container){
    var nodes = container.querySelectorAll(".mermaid:not([data-done])");
    if (nodes.length === 0) return;
    ensureMermaidLoaded(function(ok){
      var list = Array.prototype.slice.call(container.querySelectorAll(".mermaid:not([data-done])"));
      if (list.length === 0) return;
      if (!ok){
        list.forEach(function(n){
          n.setAttribute("data-done", "1");
          var code = n.textContent;
          n.innerHTML = '<div class="mermaid-fallback">Diagram Mermaid perlu koneksi internet (baru dimuat sekali). Kode diagram:</div><pre>' + escapeHtml(code) + '</pre>';
        });
        return;
      }
      list.forEach(function(n){ n.setAttribute("data-done", "1"); });
      try {
        window.mermaid.run({ nodes: list });
      } catch(e){}
    });
  }

  /* ============================================================
     1c) TAB PROYEK — setiap tab menyimpan satu dokumen terpisah
         (nama file, isi editor, mode tampilan), mirip tab Chrome.
         Nama tab mengikuti nama file yang diimpor / disimpan.
     ============================================================ */

  var ICON_FILE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 1.5h5.5L12 4v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"/><path d="M9.2 1.5V4h3"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';
  var ICON_FOLDER_MOVE = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 3.5h4l1.2 1.5h6.3a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-7.5a.5.5 0 0 1 .5-.5Z"/></svg>';
  var collapsedFolders = {};

  var tabs = [];
  var activeTabId = null;
  var tabIdSeq = 1;
  var currentMode = "edit";

  /* ---- Auto-save ke localStorage ---- */
  var AUTOSAVE_KEY = "wolioWord.autosave.v1";
  var ARCHIVE_KEY = "wolioWord.archived.v1";
  var MAX_ARCHIVE = 20;
  var AUTOSAVE_INTERVAL_MS = 10000; // 10 detik

  /* Simpan tab yang cuma "ditutup" (bukan dihapus permanen) biar riwayat & isinya gak hilang */
  function archiveTab(tab){
    var list = [];
    try {
      var raw = window.localStorage.getItem(ARCHIVE_KEY);
      if (raw) list = JSON.parse(raw) || [];
    } catch (e){ list = []; }
    list.push({
      filename: tab.filename, content: tab.content, mode: tab.mode,
      history: tab.history || [], folder: tab.folder || null, closedAt: Date.now()
    });
    if (list.length > MAX_ARCHIVE) list = list.slice(list.length - MAX_ARCHIVE);
    try { window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list)); }
    catch (e){ /* penyimpanan penuh/diblokir, abaikan */ }
  }

  /* ---- Riwayat versi (checkpoint per tab) ---- */
  var MAX_HISTORY = 30;
  var AUTO_SNAPSHOT_MIN_INTERVAL_MS = 45000; // jangan snapshot otomatis lebih sering dari ini

  function createTabData(filename, content, mode){
    return {
      id: tabIdSeq++,
      filename: filename || "unsaved.md",
      content: content != null ? content : "",
      mode: mode || "edit",
      dirty: false,
      history: [],
      folder: null
    };
  }

  function tabDisplayName(tab){
    return (tab.dirty ? "* " : "") + tab.filename;
  }

  function promptSetFolder(tab){
    var current = tab.folder || "";
    var name = window.prompt('Pindahkan "' + tab.filename + '" ke folder (kosongkan untuk keluar dari folder):', current);
    if (name === null) return; // dibatalkan
    name = name.trim();
    tab.folder = name || null;
    renderTabs();
    setStatus(name ? 'Tab dipindahkan ke folder "' + name + '".' : "Tab dikeluarkan dari folder.");
  }

  function getActiveTab(){
    for (var i = 0; i < tabs.length; i++){
      if (tabs[i].id === activeTabId) return tabs[i];
    }
    return null;
  }

  function saveActiveTabState(){
    var tab = getActiveTab();
    if (!tab) return;
    tab.content = editor.value;
    tab.filename = filenameInput.value.trim() || tab.filename;
    tab.mode = currentMode;
  }

  function pad2(n){ return (n < 10 ? "0" : "") + n; }

  function pushSnapshot(tab, label){
    if (!tab.history) tab.history = [];
    tab.history.push({ ts: Date.now(), content: tab.content, label: label });
    if (tab.history.length > MAX_HISTORY) tab.history.shift();
  }

  function maybeAutoSnapshot(tab){
    if (!tab.history) tab.history = [];
    var last = tab.history.length ? tab.history[tab.history.length - 1] : null;
    if (last && last.content === tab.content) return; // tidak ada perubahan sejak snapshot terakhir
    if (last && (Date.now() - last.ts) < AUTO_SNAPSHOT_MIN_INTERVAL_MS) return; // terlalu sering
    pushSnapshot(tab, "otomatis");
  }

  function manualCheckpoint(){
    saveActiveTabState();
    var tab = getActiveTab();
    if (!tab) return;
    pushSnapshot(tab, "manual");
    renderHistoryList();
    setStatus("Checkpoint riwayat versi disimpan.");
  }

  function restoreSnapshot(tab, snapshot){
    if (tab.content !== snapshot.content){
      pushSnapshot(tab, "sebelum pulihkan");
    }
    tab.content = snapshot.content;
    tab.dirty = true;
    if (tab.id === activeTabId){
      editor.value = snapshot.content;
      scheduleRender();
    }
    renderTabs();
    var d = new Date(snapshot.ts);
    setStatus("Versi pukul " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + " dipulihkan.");
  }

  function formatSnapshotTime(ts){
    var d = new Date(ts);
    var now = new Date();
    var sameDay = d.toDateString() === now.toDateString();
    var time = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    return sameDay ? time : (pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + " " + time);
  }

  function renderHistoryList(){
    if (!historyFlyoutList) return;
    historyFlyoutList.innerHTML = "";
    var tab = getActiveTab();
    var history = tab && tab.history ? tab.history : [];
    if (!tab || history.length === 0){
      var empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "Belum ada checkpoint untuk tab ini.";
      historyFlyoutList.appendChild(empty);
      return;
    }
    for (var i = history.length - 1; i >= 0; i--){
      (function(snapshot){
        var item = document.createElement("div");
        item.className = "history-item";
        var info = document.createElement("span");
        info.className = "history-info";
        var tag = snapshot.label === "manual" ? " · checkpoint" :
                  (snapshot.label === "sebelum pulihkan" ? " · sebelum pulihkan" : "");
        info.textContent = formatSnapshotTime(snapshot.ts) + tag;
        var restoreBtn = document.createElement("button");
        restoreBtn.type = "button";
        restoreBtn.className = "history-restore-btn";
        restoreBtn.textContent = "Pulihkan";
        restoreBtn.addEventListener("click", function(e){
          e.stopPropagation();
          restoreSnapshot(tab, snapshot);
        });
        item.appendChild(info);
        item.appendChild(restoreBtn);
        historyFlyoutList.appendChild(item);
      })(history[i]);
    }
  }

  function autosaveSerialize(){
    saveActiveTabState();
    return {
      version: 1,
      savedAt: Date.now(),
      activeTabId: activeTabId,
      tabIdSeq: tabIdSeq,
      tabs: tabs.map(function(t){
        return {
          id: t.id, filename: t.filename, content: t.content, mode: t.mode, dirty: t.dirty,
          history: (t.history || []).slice(-MAX_HISTORY),
          folder: t.folder || null
        };
      })
    };
  }

  function autosaveNow(){
    try {
      saveActiveTabState();
      var activeTab = getActiveTab();
      if (activeTab) maybeAutoSnapshot(activeTab);
      var state = autosaveSerialize();
      window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
      var d = new Date(state.savedAt);
      setStatus("Tersimpan otomatis pukul " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds()) + ".");
      renderHistoryList();
    } catch (err){
      setStatus("Auto-save gagal — penyimpanan browser penuh atau diblokir.");
    }
  }

  function tryRestoreAutosave(){
    var raw;
    try { raw = window.localStorage.getItem(AUTOSAVE_KEY); }
    catch (err){ return false; }
    if (!raw) return false;
    var state;
    try { state = JSON.parse(raw); }
    catch (err){ return false; }
    if (!state || !state.tabs || !state.tabs.length) return false;

    tabs = state.tabs.map(function(t){
      return {
        id: t.id,
        filename: t.filename || "unsaved.md",
        content: t.content != null ? t.content : "",
        mode: t.mode || "edit",
        dirty: !!t.dirty,
        history: Array.isArray(t.history) ? t.history : [],
        folder: t.folder || null
      };
    });
    var maxId = tabs.reduce(function(m, t){ return Math.max(m, t.id); }, 0);
    tabIdSeq = state.tabIdSeq && state.tabIdSeq > maxId ? state.tabIdSeq : (maxId + 1);
    var hasActive = tabs.some(function(t){ return t.id === state.activeTabId; });
    activeTabId = hasActive ? state.activeTabId : tabs[0].id;

    var activeTab = getActiveTab();
    currentMode = activeTab.mode || "edit";
    loadTabIntoEditor(activeTab);
    renderTabs();
    setStatus("Draf sebelumnya dipulihkan dari auto-save browser ini.");
    return true;
  }

  function loadTabIntoEditor(tab){
    editor.value = tab.content;
    filenameInput.value = tab.filename;
    updateStats();
    applyModeUI(tab.mode);
    renderOutline();
  }

  function renderTabs(){
    tabStrip.innerHTML = "";
    tabs.forEach(function(tab){
      var el = document.createElement("div");
      el.className = "tab" + (tab.id === activeTabId ? " active" : "");
      el.setAttribute("role", "tab");
      el.setAttribute("aria-selected", tab.id === activeTabId ? "true" : "false");
      el.title = tabDisplayName(tab);
      el.draggable = true;

      var icon = document.createElement("span");
      icon.className = "tab-icon";
      icon.innerHTML = ICON_FILE;

      var label = document.createElement("span");
      label.className = "tab-label";
      label.textContent = tabDisplayName(tab);

      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "tab-close";
      closeBtn.title = "Tutup tab";
      closeBtn.innerHTML = ICON_CLOSE;
      closeBtn.addEventListener("click", function(e){
        e.stopPropagation();
        closeTab(tab.id);
      });

      el.appendChild(icon);
      el.appendChild(label);
      el.appendChild(closeBtn);

      el.addEventListener("click", function(){ switchToTab(tab.id); });

      el.addEventListener("dragstart", function(e){
        el.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(tab.id));
      });
      el.addEventListener("dragend", function(){ el.classList.remove("dragging"); });
      el.addEventListener("dragover", function(e){ e.preventDefault(); });
      el.addEventListener("drop", function(e){
        e.preventDefault();
        var draggedId = Number(e.dataTransfer.getData("text/plain"));
        if (!draggedId || draggedId === tab.id) return;
        var fromIdx = tabs.findIndex(function(t){ return t.id === draggedId; });
        var toIdx = tabs.findIndex(function(t){ return t.id === tab.id; });
        if (fromIdx === -1 || toIdx === -1) return;
        var moved = tabs.splice(fromIdx, 1)[0];
        tabs.splice(toIdx, 0, moved);
        renderTabs();
      });

      tabStrip.appendChild(el);
    });
    renderFilesFlyout();
  }

  /* ---- Flyout vertikal daftar tab, dipicu tombol Files di activity bar ---- */
  function renderFilesFlyout(){
    if (!filesFlyoutList) return;
    filesFlyoutList.innerHTML = "";

    var groups = {};
    var order = [];
    tabs.forEach(function(tab){
      var key = tab.folder || "";
      if (!groups[key]){ groups[key] = []; order.push(key); }
      groups[key].push(tab);
    });
    // Folder bernama tampil lebih dulu (alfabet), tab tanpa folder di akhir.
    order.sort(function(a, b){
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b);
    });

    function renderTabItem(tab, inFolder){
      var item = document.createElement("div");
      item.className = "flyout-item" + (tab.id === activeTabId ? " active" : "") + (inFolder ? " in-folder" : "");
      item.innerHTML = ICON_FILE + "<span></span>";
      item.querySelector("span").textContent = tabDisplayName(tab);

      var moveBtn = document.createElement("button");
      moveBtn.type = "button";
      moveBtn.className = "folder-move-btn";
      moveBtn.title = "Pindah ke folder...";
      moveBtn.innerHTML = ICON_FOLDER_MOVE;
      moveBtn.addEventListener("click", function(e){
        e.stopPropagation();
        promptSetFolder(tab);
      });
      item.appendChild(moveBtn);

      item.addEventListener("click", function(){
        switchToTab(tab.id);
        closeFilesFlyout();
      });
      filesFlyoutList.appendChild(item);
    }

    order.forEach(function(key){
      if (key !== ""){
        var collapsed = !!collapsedFolders[key];
        var header = document.createElement("div");
        header.className = "folder-header";
        header.textContent = (collapsed ? "\u25B8 " : "\u25BE ") + key + " (" + groups[key].length + ")";
        header.addEventListener("click", function(){
          collapsedFolders[key] = !collapsed;
          renderFilesFlyout();
        });
        filesFlyoutList.appendChild(header);
        if (collapsed) return;
      }
      groups[key].forEach(function(tab){
        renderTabItem(tab, key !== "");
      });
    });

    renderHistoryList();
  }
  if (historyCheckpointBtn){
    historyCheckpointBtn.addEventListener("click", manualCheckpoint);
  }
  function openFilesFlyout(){
    closeFindBar();
    closeOutlineFlyout();
    filesFlyout.classList.add("open");
    sidebarFilesBtn.classList.add("active");
  }
  function closeFilesFlyout(){
    filesFlyout.classList.remove("open");
    sidebarFilesBtn.classList.remove("active");
  }
  function toggleFilesFlyout(){
    if (filesFlyout.classList.contains("open")) closeFilesFlyout();
    else openFilesFlyout();
  }

  /* ---- Outline / daftar isi otomatis dari heading Markdown ---- */
  function buildOutline(text){
    var lines = text.split("\n");
    var outline = [];
    var offset = 0;
    for (var i = 0; i < lines.length; i++){
      var line = lines[i];
      var m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (m){
        outline.push({
          level: m[1].length,
          text: m[2].trim(),
          offset: offset,
          lineLength: line.length
        });
      }
      offset += line.length + 1; // +1 untuk karakter \n
    }
    return outline;
  }

  function jumpToOutlineItem(item){
    if (currentMode === "preview") setMode("split");
    editor.focus();
    editor.setSelectionRange(item.offset, item.offset + item.lineLength);
    updateCursorPos();
  }

  function renderOutline(){
    if (!outlineFlyoutList) return;
    outlineFlyoutList.innerHTML = "";
    var outline = buildOutline(editor.value);
    if (outline.length === 0){
      var empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "Belum ada heading (#) di dokumen ini.";
      outlineFlyoutList.appendChild(empty);
      return;
    }
    outline.forEach(function(item){
      var el = document.createElement("div");
      el.className = "flyout-item outline-item";
      el.style.paddingLeft = (12 + (item.level - 1) * 12) + "px";
      var span = document.createElement("span");
      span.textContent = item.text || "(tanpa judul)";
      el.appendChild(span);
      el.title = item.text;
      el.addEventListener("click", function(){
        jumpToOutlineItem(item);
        closeOutlineFlyout();
      });
      outlineFlyoutList.appendChild(el);
    });
  }

  function openOutlineFlyout(){
    closeFindBar();
    closeFilesFlyout();
    renderOutline();
    outlineFlyout.classList.add("open");
    sidebarOutlineBtn.classList.add("active");
  }
  function closeOutlineFlyout(){
    outlineFlyout.classList.remove("open");
    sidebarOutlineBtn.classList.remove("active");
  }
  function toggleOutlineFlyout(){
    if (outlineFlyout.classList.contains("open")) closeOutlineFlyout();
    else openOutlineFlyout();
  }
  sidebarOutlineBtn.addEventListener("click", toggleOutlineFlyout);
  document.addEventListener("click", function(e){
    if (outlineFlyout.classList.contains("open") &&
        !outlineFlyout.contains(e.target) && e.target !== sidebarOutlineBtn && !sidebarOutlineBtn.contains(e.target)){
      closeOutlineFlyout();
    }
  });
  sidebarFilesBtn.addEventListener("click", toggleFilesFlyout);
  document.addEventListener("click", function(e){
    if (filesFlyout.classList.contains("open") &&
        !filesFlyout.contains(e.target) && e.target !== sidebarFilesBtn && !sidebarFilesBtn.contains(e.target)){
      closeFilesFlyout();
    }
  });

  function switchToTab(id){
    if (id === activeTabId) return;
    saveActiveTabState();
    activeTabId = id;
    var tab = getActiveTab();
    if (tab) loadTabIntoEditor(tab);
    renderTabs();
    setStatus('Membuka tab "' + (tab ? tab.filename : "") + '"');
  }

  function addNewTab(filename, content){
    saveActiveTabState();
    var tab = createTabData(filename, content, "edit");
    tabs.push(tab);
    activeTabId = tab.id;
    loadTabIntoEditor(tab);
    renderTabs();
    return tab;
  }

  /* ---- Template siap pakai ---- */
  var TEMPLATES = {
    readme:
      "# Nama Proyek\n\n" +
      "Deskripsi singkat satu-dua kalimat tentang apa yang dilakukan proyek ini.\n\n" +
      "## Fitur\n\n" +
      "- Fitur satu\n- Fitur dua\n- Fitur tiga\n\n" +
      "## Instalasi\n\n" +
      "```\nnpm install\n```\n\n" +
      "## Cara Pakai\n\n" +
      "Contoh singkat cara menjalankan atau memakai proyek ini.\n\n" +
      "## Lisensi\n\nMIT\n",
    cv:
      "# Nama Lengkap\n\n" +
      "Email · Nomor telepon · Kota domisili\n\n" +
      "## Ringkasan\n\n" +
      "Satu paragraf singkat tentang keahlian dan tujuan karier.\n\n" +
      "## Pengalaman Kerja\n\n" +
      "**Jabatan — Nama Perusahaan** _(Bulan Tahun – Bulan Tahun)_\n" +
      "- Pencapaian atau tanggung jawab utama\n- Pencapaian lain\n\n" +
      "## Pendidikan\n\n" +
      "**Nama Institusi** — Jurusan _(Tahun – Tahun)_\n\n" +
      "## Keterampilan\n\n" +
      "- Keterampilan satu\n- Keterampilan dua\n- Keterampilan tiga\n",
    meeting:
      "# Catatan Rapat — Judul Rapat\n\n" +
      "**Tanggal:** \n**Peserta:** \n\n" +
      "## Agenda\n\n" +
      "1. Poin agenda satu\n2. Poin agenda dua\n\n" +
      "## Pembahasan\n\n" +
      "- Ringkasan diskusi\n\n" +
      "## Keputusan\n\n" +
      "- \n\n" +
      "## Tindak Lanjut\n\n" +
      "- [ ] Tugas — Penanggung jawab — Tenggat\n"
  };
  var TEMPLATE_FILENAMES = {
    readme: "README.md",
    cv: "CV.md",
    meeting: "Catatan Rapat.md"
  };
  function newTabFromTemplate(key){
    addNewTab(TEMPLATE_FILENAMES[key], TEMPLATES[key]);
    setStatus("Tab baru dibuat dari template.");
    editor.focus();
  }

  function closeTab(id){
    var idx = tabs.findIndex(function(t){ return t.id === id; });
    if (idx === -1) return;
    var tab = tabs[idx];

    var hapusPermanen = window.confirm(
      'Hapus tab "' + tab.filename + '" beserta riwayat versinya?\n\n' +
      "OK = hapus tab + riwayat versi (permanen)\n" +
      "Batal = tutup tab aja (riwayat tetap tersimpan)"
    );
    if (!hapusPermanen) archiveTab(tab);

    var wasActive = (id === activeTabId);
    tabs.splice(idx, 1);
    if (tabs.length === 0){
      var fresh = createTabData("unsaved.md", "", "edit");
      tabs.push(fresh);
      activeTabId = fresh.id;
      loadTabIntoEditor(fresh);
    } else if (wasActive){
      var newIdx = Math.min(idx, tabs.length - 1);
      activeTabId = tabs[newIdx].id;
      loadTabIntoEditor(tabs[newIdx]);
    }
    renderTabs();
    setStatus(hapusPermanen ? 'Tab "' + tab.filename + '" & riwayatnya dihapus.' : 'Tab "' + tab.filename + '" ditutup, riwayat tersimpan.');
  }

  filenameInput.addEventListener("input", function(){
    var tab = getActiveTab();
    if (!tab) return;
    tab.filename = filenameInput.value.trim() || tab.filename;
    tab.dirty = true;
    renderTabs();
  });

  newTabBtn.addEventListener("click", function(){
    addNewTab("unsaved.md", "");
    setStatus("Tab proyek baru dibuat.");
    editor.focus();
  });

  /* ---- Tombol salin kode (delegasi klik, karena preview di-render ulang dinamis) ---- */
  function copyCodeFromButton(btn){
    var wrap = btn.closest(".code-block");
    var pre = wrap ? wrap.querySelector("pre") : btn.closest("pre");
    if (!pre) return;
    var code = pre.getAttribute("data-code") || "";
    var markCopied = function(){
      btn.classList.add("copied");
      btn.innerHTML = CHECK_ICON;
      setTimeout(function(){
        btn.classList.remove("copied");
        btn.innerHTML = COPY_ICON;
      }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(code).then(markCopied, function(){
        fallbackCopy(code, markCopied);
      });
    } else {
      fallbackCopy(code, markCopied);
    }
  }
  function fallbackCopy(text, done){
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    if (done) done();
  }
  preview.addEventListener("click", function(e){
    var btn = e.target.closest(".copy-btn");
    if (btn) copyCodeFromButton(btn);
  });

  var renderTimer = null;
  function scheduleRender(){
    updateStats();
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function(){
      renderPreview();
      renderOutline();
    }, 120);
  }

  editor.addEventListener("input", function(){
    scheduleRender();
    var tab = getActiveTab();
    if (tab && !tab.dirty){
      tab.dirty = true;
      renderTabs();
    }
    setStatus("Belum disimpan — perubahan hanya ada di browser ini.");
  });

  function wrapSelection(before, after, placeholder){
    after = after != null ? after : before;
    var start = editor.selectionStart, end = editor.selectionEnd;
    var val = editor.value;
    var selected = val.slice(start, end);
    var text = selected || (placeholder || "");
    editor.value = val.slice(0, start) + before + text + after + val.slice(end);
    editor.setSelectionRange(start + before.length, start + before.length + text.length);
    editor.focus();
    scheduleRender();
    var tab = getActiveTab();
    if (tab && !tab.dirty){
      tab.dirty = true;
      renderTabs();
    }
    updateCursorPos();
  }

  function insertMermaidSample(){
    var start = editor.selectionStart, end = editor.selectionEnd;
    var val = editor.value;
    var sample = "```mermaid\ngraph TD\n  A[Mulai] --> B{Cek kondisi}\n  B -->|Ya| C[Lakukan aksi]\n  B -->|Tidak| D[Selesai]\n```\n";
    editor.value = val.slice(0, start) + sample + val.slice(end);
    var pos = start + sample.length;
    editor.setSelectionRange(pos, pos);
    editor.focus();
    scheduleRender();
    var tab = getActiveTab();
    if (tab && !tab.dirty){
      tab.dirty = true;
      renderTabs();
    }
    updateCursorPos();
  }

  function insertLink(){
    var start = editor.selectionStart, end = editor.selectionEnd;
    var linkText = selected || "teks tautan";
    var inserted = "[" + linkText + "](url)";
    editor.value = val.slice(0, start) + inserted + val.slice(end);
    var urlStart = start + linkText.length + 3; // posisi setelah "[linkText]("
    editor.setSelectionRange(urlStart, urlStart + 3); // pilih "url" agar siap diganti
    editor.focus();
    scheduleRender();
    var tab = getActiveTab();
    if (tab && !tab.dirty){
      tab.dirty = true;
      renderTabs();
    }
    updateCursorPos();
  }

  // Tab key -> sisipkan 2 spasi, bukan pindah fokus
  // Ctrl/Cmd+B -> bold, Ctrl/Cmd+I -> italic, Ctrl/Cmd+L -> sisipkan link
  editor.addEventListener("keydown", function(e){
    var mod = e.ctrlKey || e.metaKey;
    if (e.key === "Tab"){
      e.preventDefault();
      var start = editor.selectionStart, end = editor.selectionEnd;
      editor.value = editor.value.slice(0, start) + "  " + editor.value.slice(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
      scheduleRender();
    } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b"){
      e.preventDefault();
      wrapSelection("**", "**", "teks tebal");
    } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "i"){
      e.preventDefault();
      wrapSelection("*", "*", "teks miring");
    } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "l"){
      e.preventDefault();
      insertLink();
    }
  });

  /* ---- Drag & drop gambar ke editor -> otomatis jadi Markdown ![alt](data:...) ---- */
  var editorPaneBody = document.getElementById("editorPaneBody");
  var IMAGE_MIME_RE = /^image\//;

  function insertTextAtCursor(text){
    var start = editor.selectionStart;
    var end = editor.selectionEnd;
    var val = editor.value;
    editor.value = val.slice(0, start) + text + val.slice(end);
    var newPos = start + text.length;
    editor.focus();
    editor.setSelectionRange(newPos, newPos);
    scheduleRender();
    var tab = getActiveTab();
    if (tab && !tab.dirty){
      tab.dirty = true;
      renderTabs();
    }
    updateCursorPos();
  }

  function readImageAsMarkdown(file){
    return new Promise(function(resolve){
      var reader = new FileReader();
      reader.onload = function(){
        var altText = file.name.replace(/\.[^.]+$/, "") || "gambar";
        resolve("![" + altText + "](" + reader.result + ")\n");
      };
      reader.onerror = function(){ resolve(""); };
      reader.readAsDataURL(file);
    });
  }

  function handleImageFiles(fileList){
    var imageFiles = Array.prototype.filter.call(fileList, function(f){
      return IMAGE_MIME_RE.test(f.type);
    });
    if (imageFiles.length === 0){
      setStatus("Tidak ada file gambar yang bisa disisipkan.");
      return;
    }
    setStatus("Menyisipkan " + imageFiles.length + " gambar...");
    Promise.all(imageFiles.map(readImageAsMarkdown)).then(function(snippets){
      insertTextAtCursor(snippets.join(""));
      setStatus(imageFiles.length + " gambar disisipkan sebagai Markdown.");
    });
  }

  if (editorPaneBody){
    editorPaneBody.addEventListener("dragover", function(e){
      if (!e.dataTransfer) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      editorPaneBody.classList.add("drag-over");
    });
    editorPaneBody.addEventListener("dragleave", function(e){
      if (e.target === editorPaneBody) editorPaneBody.classList.remove("drag-over");
    });
    editorPaneBody.addEventListener("drop", function(e){
      e.preventDefault();
      editorPaneBody.classList.remove("drag-over");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length){
        handleImageFiles(e.dataTransfer.files);
      }
    });
  }

  /* ---- Mode switching ---- */
  function applyModeUI(mode){
    [modeEdit, modePreview, modeSplit].forEach(function(b){ b.classList.remove("active"); });
    if (mode === "edit"){
      paneEdit.style.display = "flex";
      panePreview.style.display = "none";
      modeEdit.classList.add("active");
      mainArea.classList.remove("split-mode");
    } else if (mode === "preview"){
      paneEdit.style.display = "none";
      panePreview.style.display = "flex";
      modePreview.classList.add("active");
      mainArea.classList.remove("split-mode");
      renderPreview();
    } else {
      paneEdit.style.display = "flex";
      panePreview.style.display = "flex";
      modeSplit.classList.add("active");
      mainArea.classList.add("split-mode");
      renderPreview();
    }
    currentMode = mode;
    if (modeLabelEl){
      modeLabelEl.textContent = mode === "edit" ? "Editor" : (mode === "preview" ? "Review" : "Split");
    }
  }
  function setMode(mode){
    applyModeUI(mode);
    var tab = getActiveTab();
    if (tab) tab.mode = mode;
  }
  modeEdit.addEventListener("click", function(){ setMode("edit"); });
  modePreview.addEventListener("click", function(){ setMode("preview"); });
  modeSplit.addEventListener("click", function(){ setMode("split"); });

  /* ---- Seret batas editor/preview di mode Split ---- */
  var resizing = false;
  var resizeAxis = "row"; // "row" (kiri-kanan) atau "column" (atas-bawah, layar sempit)
  var SNAP_MARGIN = 0.07; // seret sampai 7% dari ujung -> otomatis ganti mode penuh

  function clientPos(e, axis){
    var p = e.touches && e.touches[0] ? e.touches[0] : e;
    return axis === "column" ? p.clientY : p.clientX;
  }

  function resetPaneFlex(){
    paneEdit.style.flex = "";
    panePreview.style.flex = "";
  }

  function startResize(e){
    if (currentMode !== "split") return;
    resizing = true;
    resizeAxis = getComputedStyle(mainArea).flexDirection === "column" ? "column" : "row";
    paneResizer.classList.add("dragging");
    document.body.style.userSelect = "none";
    e.preventDefault();
  }
  function stopResize(){
    if (!resizing) return;
    resizing = false;
    paneResizer.classList.remove("dragging");
    document.body.style.userSelect = "";
  }
  // Diseret sampai mentok ke ujung -> lepas dari Split, otomatis pindah ke mode penuh.
  // Editor selalu ada di "awal" (atas/kiri) & Preview di "akhir" (bawah/kanan), jadi:
  // mentok ke awal (atas di layar sempit, kiri di desktop) = Editor mengecil habis -> mode Review.
  // mentok ke akhir (bawah di layar sempit, kanan di desktop) = Preview mengecil habis -> mode Editor.
  function snapToMode(mode){
    resizing = false;
    paneResizer.classList.remove("dragging");
    document.body.style.userSelect = "";
    resetPaneFlex();
    setMode(mode);
  }
  function duringResize(e){
    if (!resizing) return;
    var rect = mainArea.getBoundingClientRect();
    var pos = clientPos(e, resizeAxis);
    var total = resizeAxis === "column" ? rect.height : rect.width;
    var offset = resizeAxis === "column" ? (pos - rect.top) : (pos - rect.left);
    var rawRatio = total > 0 ? offset / total : 0.5;
    e.preventDefault();

    if (rawRatio <= SNAP_MARGIN){
      snapToMode("preview");
      return;
    }
    if (rawRatio >= 1 - SNAP_MARGIN){
      snapToMode("edit");
      return;
    }
    paneEdit.style.flex = "1 1 " + (rawRatio * 100) + "%";
    panePreview.style.flex = "1 1 " + ((1 - rawRatio) * 100) + "%";
  }

  paneResizer.addEventListener("mousedown", startResize);
  paneResizer.addEventListener("touchstart", startResize, { passive: false });
  document.addEventListener("mousemove", duringResize);
  document.addEventListener("touchmove", duringResize, { passive: false });
  document.addEventListener("mouseup", stopResize);
  document.addEventListener("touchend", stopResize);

  /* ---- Theme toggle ----
     Catatan: penerapan tema tersimpan saat pertama kali dibuka sudah
     ditangani oleh script kecil di <head> (app.html) supaya tidak ada
     efek "kedip" tema terang sebelum berpindah ke gelap. Di sini kita
     tinggal urus toggle-nya dan menyimpan pilihan ke localStorage. */
  var THEME_KEY = "wolioWord.theme.v1";

  function applyTheme(theme){
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  homeBtn.addEventListener("click", function(){
    autosaveNow();
    window.location.href = "index.html";
  });

  themeToggle.addEventListener("click", function(){
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var next = isDark ? "light" : "dark";
    applyTheme(next);
    try { window.localStorage.setItem(THEME_KEY, next); }
    catch (e) { /* localStorage tidak tersedia, abaikan */ }
  });

  /* ---- Impor: file yang diimpor dibuka sebagai tab proyek baru,
         nama tab mengikuti nama file yang diimpor ---- */
  fileInput.addEventListener("change", function(){
    var file = fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e){
      addNewTab(file.name, e.target.result);
      scheduleRender();
      setStatus('Impor berhasil: "' + file.name + '" (tab baru dibuat)');
    };
    reader.onerror = function(){
      setStatus("Gagal mengimpor file.");
    };
    reader.readAsText(file, "UTF-8");
    fileInput.value = "";
  });

  /* ---- Impor Folder: pilih folder, semua file .md/.markdown/.txt di dalamnya
         (termasuk subfolder) otomatis dibuka sebagai tab proyek baru,
         dikelompokkan dalam satu folder tab sesuai nama folder yang dipilih.
         File dengan tipe lain (gambar, kode, dst.) diabaikan begitu saja. ---- */
  var folderInput = document.getElementById("folderInput");
  var IMPORTABLE_EXT = /\.(md|markdown|txt)$/i;

  folderInput.addEventListener("change", function(){
    var allFiles = Array.prototype.slice.call(folderInput.files || []);
    folderInput.value = "";
    if (!allFiles.length) return;

    var matched = allFiles.filter(function(f){ return IMPORTABLE_EXT.test(f.name); });
    if (!matched.length){
      setStatus("Tidak ada file .md / .txt yang terdeteksi di folder itu.");
      return;
    }

    var rootPath = matched[0].webkitRelativePath || matched[0].name;
    var rootFolder = rootPath.split("/")[0] || "Folder";

    var done = 0, failed = 0;
    matched.forEach(function(file){
      var reader = new FileReader();
      reader.onload = function(e){
        var tab = addNewTab(file.name, e.target.result);
        tab.folder = rootFolder;
        done++;
        if (done + failed === matched.length){
          renderTabs();
          scheduleRender();
          setStatus('Impor folder "' + rootFolder + '" selesai: ' + done + " file dibuka" + (failed ? ", " + failed + " gagal" : "") + ".");
        }
      };
      reader.onerror = function(){
        failed++;
        if (done + failed === matched.length){
          renderTabs();
          scheduleRender();
          setStatus('Impor folder "' + rootFolder + '" selesai: ' + done + " file dibuka" + (failed ? ", " + failed + " gagal" : "") + ".");
        }
      };
      reader.readAsText(file, "UTF-8");
    });
  });

  /* ---- Export helpers ---- */
  function download(filename, mime, content){
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }

  function exportMd(){
    var name = (filenameInput.value.trim() || "README.md");
    if (!/\.(md|markdown)$/i.test(name)) name += ".md";
    download(name, "text/markdown;charset=utf-8", editor.value);
    filenameInput.value = name;
    var tab = getActiveTab();
    if (tab){ tab.filename = name; tab.dirty = false; renderTabs(); }
    setStatus('Disimpan sebagai "' + name + '"');
  }

  function exportTxt(){
    var name = (filenameInput.value.trim().replace(/\.\w+$/, "") || "README") + ".txt";
    download(name, "text/plain;charset=utf-8", editor.value);
    setStatus('Diekspor sebagai teks: "' + name + '"');
  }

  var EXPORT_COPY_SCRIPT =
    "var EX_COPY_ICON = '" + COPY_ICON.replace(/'/g, "\\'") + "';\n" +
    "var EX_CHECK_ICON = '" + CHECK_ICON.replace(/'/g, "\\'") + "';\n" +
    "document.addEventListener('click', function(e){\n" +
    "  var btn = e.target.closest('.copy-btn');\n" +
    "  if (!btn) return;\n" +
    "  var wrap = btn.closest('.code-block');\n" +
    "  var pre = wrap ? wrap.querySelector('pre') : btn.closest('pre');\n" +
    "  var code = pre ? (pre.getAttribute('data-code') || '') : '';\n" +
    "  function done(){\n" +
    "    btn.classList.add('copied');\n" +
    "    btn.innerHTML = EX_CHECK_ICON;\n" +
    "    setTimeout(function(){ btn.classList.remove('copied'); btn.innerHTML = EX_COPY_ICON; }, 1600);\n" +
    "  }\n" +
    "  if (navigator.clipboard && navigator.clipboard.writeText){\n" +
    "    navigator.clipboard.writeText(code).then(done, function(){ fallback(); });\n" +
    "  } else { fallback(); }\n" +
    "  function fallback(){\n" +
    "    var ta = document.createElement('textarea');\n" +
    "    ta.value = code; ta.style.position='fixed'; ta.style.opacity='0';\n" +
    "    document.body.appendChild(ta); ta.focus(); ta.select();\n" +
    "    try { document.execCommand('copy'); } catch(err) {}\n" +
    "    document.body.removeChild(ta); done();\n" +
    "  }\n" +
    "});";

  function exportPdf(){
    saveActiveTabState();
    renderPreview();
    var tab = getActiveTab();
    var prevTitle = document.title;
    var pdfName = ((tab ? tab.filename : "") || "dokumen").replace(/\.[^.]+$/, "") || "dokumen";
    document.title = pdfName;
    setStatus('Membuka dialog cetak — pilih "Simpan sebagai PDF" pada tujuan/printer.');
    function restoreTitle(){
      document.title = prevTitle;
      window.removeEventListener("afterprint", restoreTitle);
    }
    window.addEventListener("afterprint", restoreTitle);
    setTimeout(function(){ window.print(); }, 30);
  }

  function exportHtml(){
    var name = (filenameInput.value.trim().replace(/\.(md|markdown)$/i, "") || "README") + ".html";
    var bodyHtml = renderMarkdown(editor.value);
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var fullHtml = "<!DOCTYPE html>\n<html lang=\"id\"" + (isDark ? ' data-theme="dark"' : "") + ">\n<head>\n<meta charset=\"UTF-8\">\n<title>" +
      escapeHtml(name.replace(/\.html$/i, "")) +
      "</title>\n<style>\n" + document.getElementById("exportStyle").textContent + "\n</style>\n</head>\n<body>\n<div style=\"max-width:1100px;margin:40px auto;padding:0 24px;\">\n<article class=\"markdown-body\">\n" +
      bodyHtml + "\n</article>\n</div>\n<script>\n" + EXPORT_COPY_SCRIPT + "\n</script>\n</body>\n</html>\n";
    download(name, "text/html;charset=utf-8", fullHtml);
    setStatus('Diekspor sebagai halaman HTML: "' + name + '"');
  }

  /* ---- Flyout Impor/Ekspor (dipicu tombol gerigi di sidebar) ---- */
  var sidebarSettingsBtn = document.getElementById("sidebarSettingsBtn");
  var settingsFlyout = document.getElementById("settingsFlyout");
  var settingsImportBtn = document.getElementById("settingsImportBtn");

  function closeSettingsFlyout(){
    settingsFlyout.classList.remove("open");
    sidebarSettingsBtn.classList.remove("active");
  }
  function openSettingsFlyout(){
    closeFilesFlyout();
    closeFindBar();
    closeOutlineFlyout();
    settingsFlyout.classList.add("open");
    sidebarSettingsBtn.classList.add("active");
  }
  function toggleSettingsFlyout(){
    if (settingsFlyout.classList.contains("open")) closeSettingsFlyout();
    else openSettingsFlyout();
  }
  sidebarSettingsBtn.addEventListener("click", toggleSettingsFlyout);

  settingsImportBtn.addEventListener("click", function(){
    closeSettingsFlyout();
    fileInput.click();
  });

  var settingsImportFolderBtn = document.getElementById("settingsImportFolderBtn");
  settingsImportFolderBtn.addEventListener("click", function(){
    closeSettingsFlyout();
    folderInput.click();
  });

  settingsFlyout.addEventListener("click", function(e){
    var btn = e.target.closest("[data-export]");
    if (!btn) return;
    closeSettingsFlyout();
    var kind = btn.getAttribute("data-export");
    if (kind === "md") exportMd();
    else if (kind === "html") exportHtml();
    else if (kind === "txt") exportTxt();
    else if (kind === "pdf") exportPdf();
  });

  document.addEventListener("click", function(e){
    if (settingsFlyout.classList.contains("open") &&
        !settingsFlyout.contains(e.target) && e.target !== sidebarSettingsBtn && !sidebarSettingsBtn.contains(e.target)){
      closeSettingsFlyout();
    }
  });

  /* Gaya markdown-body yang disematkan ulang ke file HTML hasil ekspor,
     supaya file hasil ekspor tetap berdiri sendiri (tanpa aset eksternal).
     Ini adalah salinan dari bagian relevan style.css -- disimpan terpisah
     di sini karena file HTML hasil ekspor tidak boleh bergantung pada
     style.css eksternal (harus mandiri / bisa dibuka standalone). */
var EXPORT_CSS =
"body{background:var(--bg);color:var(--fg);font-family:'Atkinson Hyperlegible',-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif;}\n:root{\n  --bg:#ffffff;\n  --bg-secondary:#f6f8fa;\n  --fg:#1f2328;\n  --fg-muted:#59636e;\n  --border:#d1d9e0;\n  --accent:#0969da;\n  --code-bg:#eff1f3;\n  --btn-bg:#f6f8fa;\n  --btn-bg-hover:#eef1f3;\n  --btn-border:#d1d9e0;\n  --btn-active-bg:#0969da;\n  --btn-active-fg:#ffffff;\n  --shadow:0 1px 0 rgba(31,35,40,.04);\n  --table-stripe:#f6f8fa;\n  --blockquote-border:#d1d9e0;\n  --danger:#cf222e;\n  --scrollbar:#d1d9e0;\n  --tok-comment:#6e7781;\n  --tok-string:#0a3069;\n  --tok-number:#0550ae;\n  --tok-keyword:#cf222e;\n  --tok-boolean:#0550ae;\n  --tok-function:#8250df;\n  --tok-class:#953800;\n  --tok-tag:#116329;\n  --tok-attr:#0550ae;\n  --tok-property:#0550ae;\n  --tok-key:#0a3069;\n  --tok-variable:#953800;\n  font-family: 'Atkinson Hyperlegible', -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans\", Helvetica, Arial, sans-serif;\n}\n[data-theme=\"dark\"]{\n  --bg:#0d1117;\n  --bg-secondary:#161b22;\n  --fg:#e6edf3;\n  --fg-muted:#8b949e;\n  --border:#30363d;\n  --accent:#4493f8;\n  --code-bg:#1e2530;\n  --btn-bg:#21262d;\n  --btn-bg-hover:#30363d;\n  --btn-border:#30363d;\n  --btn-active-bg:#1f6feb;\n  --btn-active-fg:#ffffff;\n  --shadow:0 1px 0 rgba(0,0,0,.2);\n  --table-stripe:#161b22;\n  --blockquote-border:#3b434b;\n  --scrollbar:#30363d;\n  --tok-comment:#6a9955;\n  --tok-string:#ce9178;\n  --tok-number:#b5cea8;\n  --tok-keyword:#569cd6;\n  --tok-boolean:#569cd6;\n  --tok-function:#dcdcaa;\n  --tok-class:#4ec9b0;\n  --tok-tag:#569cd6;\n  --tok-attr:#9cdcfe;\n  --tok-property:#9cdcfe;\n  --tok-key:#9cdcfe;\n  --tok-variable:#9cdcfe;\n}\n/* ================= Markdown preview styling (GitHub-like) ================= */\n.markdown-body{\n  font-size:16px;\n  line-height:1.6;\n  word-wrap:break-word;\n}\n.markdown-body > *:first-child{margin-top:0 !important;}\n.markdown-body > *:last-child{margin-bottom:0 !important;}\n.markdown-body h1,.markdown-body h2,.markdown-body h3,\n.markdown-body h4,.markdown-body h5,.markdown-body h6{\n  font-weight:600;\n  line-height:1.25;\n  margin-top:24px;\n  margin-bottom:16px;\n}\n.markdown-body h1{font-size:2em;padding-bottom:.3em;border-bottom:1px solid var(--border);}\n.markdown-body h2{font-size:1.5em;padding-bottom:.3em;border-bottom:1px solid var(--border);}\n.markdown-body h3{font-size:1.25em;}\n.markdown-body h4{font-size:1em;}\n.markdown-body h5{font-size:.875em;}\n.markdown-body h6{font-size:.85em;color:var(--fg-muted);}\n.markdown-body p{margin-top:0;margin-bottom:16px;}\n.markdown-body a{color:var(--accent);text-decoration:none;}\n.markdown-body a:hover{text-decoration:underline;}\n.markdown-body ul,.markdown-body ol{margin-top:0;margin-bottom:16px;padding-left:2em;}\n.markdown-body li{margin-top:.25em;}\n.markdown-body li + li{margin-top:.25em;}\n.markdown-body li > p{margin-bottom:0;}\n.markdown-body .task-list-item{list-style:none;margin-left:-1.4em;}\n.markdown-body .task-list-item input{margin-right:.5em;}\n.markdown-body blockquote{\n  margin:0 0 16px;\n  padding:0 1em;\n  color:var(--fg-muted);\n  border-left:.25em solid var(--blockquote-border);\n}\n.markdown-body blockquote > *:last-child{margin-bottom:0;}\n.markdown-body code{\n  font-family:ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace;\n  background:var(--code-bg);\n  padding:.2em .4em;\n  border-radius:6px;\n  font-size:85%;\n}\n.code-block{\n  position:relative;\n  margin-bottom:16px;\n}\n.markdown-body pre{\n  background:var(--code-bg);\n  padding:34px 16px 16px;\n  border-radius:6px;\n  overflow:auto;\n  margin-bottom:0;\n  line-height:1.45;\n}\n.markdown-body pre code{\n  background:none;\n  padding:0;\n  font-size:85%;\n  white-space:pre;\n}\n.code-toolbar{\n  position:absolute;\n  top:6px;\n  right:8px;\n  left:8px;\n  display:flex;\n  align-items:center;\n  justify-content:flex-end;\n  gap:8px;\n  pointer-events:none;\n  z-index:1;\n}\n.code-toolbar > *{pointer-events:auto;}\n.code-toolbar .lang-tag{\n  font-size:11px;\n  color:var(--fg-muted);\n  text-transform:uppercase;\n  letter-spacing:.04em;\n  margin-right:auto;\n}\n.copy-btn{\n  font-family:inherit;\n  padding:4px;\n  border-radius:5px;\n  border:none;\n  background:transparent;\n  color:var(--fg-muted);\n  cursor:pointer;\n  display:inline-flex;\n  align-items:center;\n  justify-content:center;\n  opacity:.85;\n  transition:background .1s ease, color .1s ease;\n}\n.copy-btn:hover{background:var(--btn-bg-hover);color:var(--fg);opacity:1;}\n.copy-btn svg{width:14px;height:14px;display:block;}\n.copy-btn.copied{color:#1a7f37;}\n[data-theme=\"dark\"] .copy-btn.copied{color:#3fb950;}\n\n/* ---- Syntax highlighting token warna (gaya ala VS Code) ---- */\n.tok-comment{color:var(--tok-comment);font-style:italic;}\n.tok-string{color:var(--tok-string);}\n.tok-number{color:var(--tok-number);}\n.tok-keyword{color:var(--tok-keyword);font-weight:600;}\n.tok-boolean{color:var(--tok-boolean);}\n.tok-function{color:var(--tok-function);}\n.tok-class{color:var(--tok-class);}\n.tok-tag{color:var(--tok-tag);}\n.tok-attr{color:var(--tok-attr);}\n.tok-property{color:var(--tok-property);}\n.tok-key{color:var(--tok-key);}\n.tok-variable{color:var(--tok-variable);}\n.markdown-body hr{\n  height:.25em;\n  padding:0;\n  margin:24px 0;\n  background:var(--border);\n  border:0;\n}\n.markdown-body table{\n  border-collapse:collapse;\n  display:block;\n  width:max-content;\n  max-width:100%;\n  overflow:auto;\n  margin-bottom:16px;\n}\n.markdown-body table th{font-weight:600;background:var(--bg-secondary);}\n.markdown-body table th,.markdown-body table td{\n  border:1px solid var(--border);\n  padding:6px 13px;\n}\n.markdown-body table tr:nth-child(2n){background:var(--table-stripe);}\n.markdown-body img{max-width:100%;box-sizing:content-box;background:var(--bg);border-radius:4px;}\n.markdown-body h1 .anchor,.markdown-body h2 .anchor{display:none;}\n.markdown-body kbd{\n  background:var(--bg-secondary);\n  border:1px solid var(--border);\n  border-bottom-width:2px;\n  border-radius:6px;\n  padding:2px 5px;\n  font-size:85%;\n  font-family:ui-monospace,monospace;\n}\n.markdown-body del{color:var(--fg-muted);}\n.markdown-body .empty-hint{color:var(--fg-muted);font-style:italic;}\n";
  var exportStyleTag = document.createElement("script");
  exportStyleTag.type = "text/plain";
  exportStyleTag.id = "exportStyle";
  exportStyleTag.textContent = EXPORT_CSS;
  document.head.appendChild(exportStyleTag);

  /* ============================================================
     3) FITUR TAMBAHAN: posisi kursor, cari & ganti, command palette
     ============================================================ */

  /* ---- Posisi baris:kolom di status bar (ala VSCode) ---- */
  function updateCursorPos(){
    if (!cursorPosEl) return;
    var pos = editor.selectionStart;
    var textBefore = editor.value.slice(0, pos);
    var linesBefore = textBefore.split("\n");
    var line = linesBefore.length;
    var col = linesBefore[linesBefore.length - 1].length + 1;
    cursorPosEl.textContent = "Baris " + line + ", Kol " + col;
  }
  ["input", "keyup", "click", "select"].forEach(function(evt){
    editor.addEventListener(evt, updateCursorPos);
  });

  /* ---- Cari & Ganti ---- */
  function closeFindBar(){
    findBar.classList.remove("open");
    sidebarSearchBtn.classList.remove("active");
  }
  function openFindBar(){
    closeFilesFlyout();
    closeOutlineFlyout();
    findBar.classList.add("open");
    sidebarSearchBtn.classList.add("active");
    findInput.focus();
    findInput.select();
    updateFindCount();
  }
  function toggleFindBar(){
    if (findBar.classList.contains("open")) closeFindBar();
    else openFindBar();
  }
  sidebarSearchBtn.addEventListener("click", toggleFindBar);
  findCloseBtn.addEventListener("click", closeFindBar);

  function countMatches(needle){
    if (!needle) return 0;
    var text = editor.value.toLowerCase();
    needle = needle.toLowerCase();
    var count = 0, idx = 0;
    while (true){
      idx = text.indexOf(needle, idx);
      if (idx === -1) break;
      count++;
      idx += needle.length;
    }
    return count;
  }
  function updateFindCount(){
    var needle = findInput.value;
    if (!needle){ findCount.textContent = ""; return; }
    findCount.textContent = countMatches(needle) + " hasil";
  }
  findInput.addEventListener("input", updateFindCount);

  function findFrom(startPos, forward){
    var needle = findInput.value;
    if (!needle) return;
    var text = editor.value.toLowerCase();
    var target = needle.toLowerCase();
    var idx;
    if (forward){
      idx = text.indexOf(target, startPos);
      if (idx === -1) idx = text.indexOf(target, 0);
    } else {
      idx = text.lastIndexOf(target, Math.max(0, startPos - 1));
      if (idx === -1) idx = text.lastIndexOf(target);
    }
    if (idx === -1){
      setStatus('Tidak ditemukan: "' + needle + '"');
      return;
    }
    editor.focus();
    editor.setSelectionRange(idx, idx + needle.length);
    updateCursorPos();
  }
  findNextBtn.addEventListener("click", function(){
    findFrom(editor.selectionEnd, true);
  });
  findPrevBtn.addEventListener("click", function(){
    findFrom(editor.selectionStart, false);
  });
  findInput.addEventListener("keydown", function(e){
    if (e.key === "Enter"){
      e.preventDefault();
      findFrom(editor.selectionEnd, !e.shiftKey ? true : false);
    } else if (e.key === "Escape"){
      closeFindBar();
    }
  });

  function replaceOne(){
    var needle = findInput.value;
    if (!needle) return;
    var start = editor.selectionStart, end = editor.selectionEnd;
    var selected = editor.value.slice(start, end);
    if (selected.toLowerCase() === needle.toLowerCase()){
      var val = editor.value;
      editor.value = val.slice(0, start) + replaceInput.value + val.slice(end);
      editor.setSelectionRange(start, start + replaceInput.value.length);
      scheduleRender();
      setStatus("1 kecocokan diganti.");
    }
    findFrom(editor.selectionEnd, true);
  }
  function replaceAll(){
    var needle = findInput.value;
    if (!needle) return;
    var text = editor.value;
    var lower = text.toLowerCase();
    var target = needle.toLowerCase();
    var pieces = [];
    var idx = 0, count = 0;
    while (true){
      var found = lower.indexOf(target, idx);
      if (found === -1){ pieces.push(text.slice(idx)); break; }
      pieces.push(text.slice(idx, found));
      pieces.push(replaceInput.value);
      idx = found + needle.length;
      count++;
    }
    if (count > 0){
      editor.value = pieces.join("");
      scheduleRender();
    }
    setStatus(count + " kecocokan diganti.");
    updateFindCount();
  }
  replaceOneBtn.addEventListener("click", replaceOne);
  replaceAllBtn.addEventListener("click", replaceAll);

  /* ---- Command Palette ---- */
  var paletteCommands = [
    { label: "Baru: Tab proyek baru", hint: "New Tab", run: function(){ newTabBtn.click(); } },
    { label: "Baru: dari template README", hint: "Template", run: function(){ newTabFromTemplate("readme"); } },
    { label: "Baru: dari template CV", hint: "Template", run: function(){ newTabFromTemplate("cv"); } },
    { label: "Baru: dari template Catatan Rapat", hint: "Template", run: function(){ newTabFromTemplate("meeting"); } },
    { label: "Impor file .md / .txt", hint: "Import", run: function(){ fileInput.click(); } },
    { label: "Impor folder .md / .txt", hint: "Import", run: function(){ folderInput.click(); } },
    { label: "Ekspor sebagai .md", hint: "Ctrl+S", run: exportMd },
    { label: "Ekspor sebagai .txt", hint: "Export", run: exportTxt },
    { label: "Ekspor sebagai .html", hint: "Export", run: exportHtml },
    { label: "Ekspor sebagai .pdf", hint: "Export", run: exportPdf },
    { label: "Format: Tebal (Bold)", hint: "Ctrl+B", run: function(){ wrapSelection("**", "**", "teks tebal"); } },
    { label: "Format: Miring (Italic)", hint: "Ctrl+I", run: function(){ wrapSelection("*", "*", "teks miring"); } },
    { label: "Sisipkan tautan (Link)", hint: "Ctrl+L", run: insertLink },
    { label: "Sisipkan contoh diagram Mermaid", hint: "Diagram", run: insertMermaidSample },
    { label: "Ganti tema terang / gelap", hint: "Theme", run: function(){ themeToggle.click(); } },
    { label: "Mode: Editor", hint: "View", run: function(){ setMode("edit"); } },
    { label: "Mode: Review", hint: "View", run: function(){ setMode("preview"); } },
    { label: "Mode: Split", hint: "View", run: function(){ setMode("split"); } },
    { label: "Cari & Ganti", hint: "Find", run: openFindBar },
    { label: "Tampilkan daftar tab", hint: "Files", run: openFilesFlyout },
    { label: "Pindahkan tab aktif ke folder...", hint: "Folder", run: function(){ var t = getActiveTab(); if (t) promptSetFolder(t); } },
    { label: "Tampilkan daftar isi (outline)", hint: "Outline", run: openOutlineFlyout },
    { label: "Simpan checkpoint riwayat versi", hint: "History", run: manualCheckpoint },
    { label: "Buka panel Impor/Ekspor", hint: "Settings", run: openSettingsFlyout }
  ];
  var paletteSelected = 0;
  function renderPalette(filtered){
    paletteList.innerHTML = "";
    if (filtered.length === 0){
      var empty = document.createElement("div");
      empty.className = "palette-empty";
      empty.textContent = "Tidak ada perintah yang cocok.";
      paletteList.appendChild(empty);
      return;
    }
    filtered.forEach(function(cmd, i){
      var item = document.createElement("div");
      item.className = "palette-item" + (i === paletteSelected ? " selected" : "");
      var labelSpan = document.createElement("span");
      labelSpan.textContent = cmd.label;
      var hintSpan = document.createElement("span");
      hintSpan.className = "hint";
      hintSpan.textContent = cmd.hint;
      item.appendChild(labelSpan);
      item.appendChild(hintSpan);
      item.addEventListener("click", function(){
        closePalette();
        cmd.run();
      });
      paletteList.appendChild(item);
    });
  }
  function filterPalette(){
    var q = paletteInput.value.trim().toLowerCase();
    var filtered = !q ? paletteCommands : paletteCommands.filter(function(c){
      return c.label.toLowerCase().indexOf(q) !== -1;
    });
    paletteSelected = 0;
    renderPalette(filtered);
    return filtered;
  }
  function openPalette(){
    closeFilesFlyout();
    closeFindBar();
    paletteOverlay.classList.add("open");
    paletteInput.value = "";
    filterPalette();
    setTimeout(function(){ paletteInput.focus(); }, 0);
  }
  function closePalette(){
    paletteOverlay.classList.remove("open");
  }
  sidebarPaletteBtn.addEventListener("click", openPalette);
  paletteInput.addEventListener("input", filterPalette);
  paletteInput.addEventListener("keydown", function(e){
    var filtered = paletteCommands.filter(function(c){
      var q = paletteInput.value.trim().toLowerCase();
      return !q || c.label.toLowerCase().indexOf(q) !== -1;
    });
    if (e.key === "ArrowDown"){
      e.preventDefault();
      paletteSelected = Math.min(paletteSelected + 1, filtered.length - 1);
      renderPalette(filtered);
    } else if (e.key === "ArrowUp"){
      e.preventDefault();
      paletteSelected = Math.max(paletteSelected - 1, 0);
      renderPalette(filtered);
    } else if (e.key === "Enter"){
      e.preventDefault();
      if (filtered[paletteSelected]){
        closePalette();
        filtered[paletteSelected].run();
      }
    } else if (e.key === "Escape"){
      closePalette();
    }
  });
  paletteOverlay.addEventListener("click", function(e){
    if (e.target === paletteOverlay) closePalette();
  });

  /* ---- Shortcut global: Ctrl/Cmd+K palette, Ctrl/Cmd+F cari, Ctrl/Cmd+S simpan ---- */
  document.addEventListener("keydown", function(e){
    var mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "k"){
      e.preventDefault();
      if (paletteOverlay.classList.contains("open")) closePalette();
      else openPalette();
    } else if (mod && e.key.toLowerCase() === "f"){
      e.preventDefault();
      openFindBar();
    } else if (mod && e.key.toLowerCase() === "s"){
      e.preventDefault();
      exportMd();
    } else if (e.key === "Escape"){
      if (filesFlyout.classList.contains("open")) closeFilesFlyout();
      if (outlineFlyout.classList.contains("open")) closeOutlineFlyout();
    }
  });

  /* ---- Init ---- */
  if (!tryRestoreAutosave()){
    var initialTab = createTabData("README.md", DEFAULT_CONTENT, "edit");
    tabs.push(initialTab);
    activeTabId = initialTab.id;
    loadTabIntoEditor(initialTab);
    renderTabs();
  }

  try {
    var startAction = new URLSearchParams(window.location.search).get("action");
    if (startAction === "import"){
      window.history.replaceState(null, "", window.location.pathname);
      setTimeout(function(){ fileInput.click(); }, 300);
    } else if (startAction){
      window.history.replaceState(null, "", window.location.pathname);
    }
  } catch (e) { /* abaikan */ }

  setInterval(autosaveNow, AUTOSAVE_INTERVAL_MS);
  window.addEventListener("beforeunload", autosaveNow);
  document.addEventListener("visibilitychange", function(){
    if (document.visibilityState === "hidden") autosaveNow();
  });
})();

/* ---- PWA: registrasi service worker ---- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js").catch(function(err){
      console.warn("Registrasi service worker gagal:", err);
    });
  });
}

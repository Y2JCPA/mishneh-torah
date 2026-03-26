#!/usr/bin/env node
/**
 * Inject font-size control widget into all HTML files.
 * 
 * Widget: small floating pill (bottom-left) with A-/A+ buttons.
 * - Semi-transparent until hovered
 * - Saves preference to localStorage
 * - Applies via CSS variable on :root
 * - Matches the gold/dark theme
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// The snippet to inject before </body>
const SNIPPET = `
<!-- Font Size Control -->
<style>
:root{--fs-scale:1}
.fs-ctl{position:fixed;bottom:60px;left:12px;z-index:999;display:flex;align-items:center;gap:0;background:#222e;border:1px solid #333;border-radius:20px;padding:2px;opacity:0.35;transition:opacity 0.3s;backdrop-filter:blur(6px);user-select:none}
.fs-ctl:hover{opacity:1}
.fs-btn{background:none;border:none;color:#c9a84c;font-weight:700;cursor:pointer;padding:4px 8px;font-size:0.85rem;line-height:1;border-radius:16px;transition:background 0.2s}
.fs-btn:hover{background:#c9a84c22}
.fs-btn:active{background:#c9a84c44}
.fs-label{color:#888;font-size:0.65rem;padding:0 2px;min-width:28px;text-align:center}
</style>
<div class="fs-ctl" title="Adjust font size">
<button class="fs-btn" onclick="adjFS(-1)" aria-label="Decrease font size">A−</button>
<span class="fs-label" id="fs-pct">100%</span>
<button class="fs-btn" onclick="adjFS(1)" aria-label="Increase font size">A+</button>
</div>
<script>
(function(){
  var STEPS=[0.8,0.85,0.9,0.95,1,1.05,1.1,1.15,1.2,1.3,1.4,1.5];
  var idx=parseInt(localStorage.getItem('mt-fs-idx'));
  if(isNaN(idx))idx=4;
  apply();
  window.adjFS=function(d){idx=Math.max(0,Math.min(STEPS.length-1,idx+d));localStorage.setItem('mt-fs-idx',idx);apply()};
  function apply(){
    var s=STEPS[idx];
    document.documentElement.style.setProperty('--fs-scale',s);
    document.body.style.fontSize=(s*100)+'%';
    var el=document.getElementById('fs-pct');
    if(el)el.textContent=Math.round(s*100)+'%';
  }
})();
</script>
`;

// Old marker to find and replace existing injection
const MARKER = '<!-- Font Size Control -->';

// Updated snippet with html root scaling
const SNIPPET_V2 = `
<!-- Font Size Control -->
<style>
.fs-ctl{position:fixed;bottom:60px;left:12px;z-index:999;display:flex;align-items:center;gap:0;background:#222e;border:1px solid #333;border-radius:20px;padding:2px;opacity:0.35;transition:opacity 0.3s;backdrop-filter:blur(6px);user-select:none}
.fs-ctl:hover{opacity:1}
.fs-btn{background:none;border:none;color:#c9a84c;font-weight:700;cursor:pointer;padding:4px 8px;font-size:14px;line-height:1;border-radius:16px;transition:background 0.2s}
.fs-btn:hover{background:#c9a84c22}
.fs-btn:active{background:#c9a84c44}
.fs-label{color:#888;font-size:11px;padding:0 2px;min-width:28px;text-align:center}
</style>
<div class="fs-ctl" title="Adjust font size">
<button class="fs-btn" onclick="adjFS(-1)" aria-label="Decrease font size">A−</button>
<span class="fs-label" id="fs-pct">100%</span>
<button class="fs-btn" onclick="adjFS(1)" aria-label="Increase font size">A+</button>
</div>
<script>
(function(){
  var STEPS=[80,85,90,95,100,105,110,115,120,130,140,150];
  var idx=parseInt(localStorage.getItem('mt-fs-idx'));
  if(isNaN(idx))idx=4;
  apply();
  window.adjFS=function(d){idx=Math.max(0,Math.min(STEPS.length-1,idx+d));localStorage.setItem('mt-fs-idx',idx);apply()};
  function apply(){
    var pct=STEPS[idx];
    document.documentElement.style.fontSize=pct+'%';
    var el=document.getElementById('fs-pct');
    if(el)el.textContent=pct+'%';
  }
})();
</script>
`;

let count = 0;
let skipped = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      walk(full);
    } else if (entry.name.endsWith('.html')) {
      processFile(full);
    }
  }
}

function processFile(filepath) {
  let html = fs.readFileSync(filepath, 'utf8');
  
  // Remove old injection if present
  const markerStart = html.indexOf(MARKER);
  if (markerStart !== -1) {
    // Find the end of old snippet (ends with closing </script> + newline before </body>)
    const endTag = '</script>\n';
    let endIdx = html.indexOf(endTag, markerStart);
    if (endIdx !== -1) {
      endIdx += endTag.length;
      // Remove any trailing newlines
      while (html[endIdx] === '\n') endIdx++;
      html = html.slice(0, markerStart) + html.slice(endIdx);
    }
  }
  
  // Insert before </body>
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) {
    const idx2 = html.lastIndexOf('</html>');
    if (idx2 === -1) {
      console.log('SKIP (no body/html tag):', filepath);
      skipped++;
      return;
    }
    html = html.slice(0, idx2) + SNIPPET_V2 + '\n' + html.slice(idx2);
  } else {
    html = html.slice(0, idx) + SNIPPET_V2 + '\n' + html.slice(idx);
  }
  
  fs.writeFileSync(filepath, html, 'utf8');
  count++;
}

walk(ROOT);
console.log(`Done! Injected into ${count} files. Skipped ${skipped}.`);

// lib/export/faq-script.ts

export const FAQ_RUNTIME_SCRIPT = `
<script>
(function () {
  var BOOT_KEY = '__ffFaqBootCount';
  window[BOOT_KEY] = (window[BOOT_KEY] || 0);

  function findAnswerFor(q) {
    var n = q.nextElementSibling;
    while (n) {
      if (n.tagName && n.tagName.toLowerCase() === 'div') return n;
      n = n.nextElementSibling;
    }
    return null;
  }

  function setOpen(q, a, o) {
    if (!a) return;
    if (o) {
      a.style.setProperty('display', 'block', 'important');
      a.style.setProperty('visibility', 'visible', 'important');
      a.style.setProperty('opacity', '1', 'important');
      a.style.setProperty('height', 'auto', 'important');
      a.style.setProperty('max-height', 'none', 'important');
      a.style.setProperty('min-height', '0', 'important');
      a.style.setProperty('overflow', 'visible', 'important');
      a.style.setProperty('clip', 'auto', 'important');
      a.style.setProperty('clip-path', 'none', 'important');
      a.style.setProperty('transform', 'none', 'important');
      a.style.setProperty('pointer-events', 'auto', 'important');
      q.setAttribute('data-ff-faq-open', 'true');
      var i = q.querySelector('i[class*="fa-chevron"]');
      if (i) {
        i.classList.remove('fa-chevron-circle-down');
        i.classList.add('fa-chevron-circle-up');
      }
    } else {
      a.style.setProperty('display', 'none', 'important');
      a.style.setProperty('height', '0', 'important');
      a.style.setProperty('max-height', '0', 'important');
      a.style.setProperty('overflow', 'hidden', 'important');
      q.setAttribute('data-ff-faq-open', 'false');
      var i2 = q.querySelector('i[class*="fa-chevron"]');
      if (i2) {
        i2.classList.remove('fa-chevron-circle-up');
        i2.classList.add('fa-chevron-circle-down');
      }
    }
  }

  function bindAll() {
    var bound = 0;
    var icons = document.querySelectorAll('i[class*="fa-chevron-circle"]');
    for (var k = 0; k < icons.length; k++) {
      var icon = icons[k];
      var q = icon.parentElement;
      if (!q) continue;
      if (q.getAttribute('data-ff-faq-question') === 'true') continue;
      var a = findAnswerFor(q);
      if (!a) continue;
      q.setAttribute('data-ff-faq-question', 'true');
      q.style.cursor = 'pointer';
      setOpen(q, a, false);
      (function (qq, aa) {
        qq.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var open = qq.getAttribute('data-ff-faq-open') === 'true';
          setOpen(qq, aa, !open);
        });
      })(q, a);
      bound++;
    }
    window[BOOT_KEY] = (window[BOOT_KEY] || 0) + 1;
    window.__ffFaqBooted = true;
    if (bound > 0) {
      try { console.log('[FAQ] bound', bound, 'questions (pass ' + window[BOOT_KEY] + ')'); } catch(e) {}
    }
    return bound;
  }

  function boot() { bindAll(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  setTimeout(boot, 300);
  setTimeout(boot, 800);
  setTimeout(boot, 1500);
  setTimeout(boot, 3000);

  try {
    var obs = new MutationObserver(function () { boot(); });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { try { obs.disconnect(); } catch(e) {} }, 10000);
  } catch (e) {}
})();
</script>
`;

export function pageNeedsFaqRuntime(): boolean {
  return true;
}

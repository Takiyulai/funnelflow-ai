// check.js - vérifie ce que ScrapingBee a réellement livré
const fs = require('fs');

// Lance ScrapingBee manuellement pour récupérer le HTML brut
const apiKey = "C3SIEDKH7PGUV5TMYXWMRENYW477Q39D3Q3BMKK43V5MWQSWZYR3XDFP3BHFH357QM9QXHC5610H822U";
const url = "https://idrissou0dramane.systeme.io/vente-fitness";
const endpoint = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=5000&wait_browser=networkidle2`;

fetch(endpoint).then(r => r.text()).then(html => {
  fs.writeFileSync('sio-raw.html', html);
  console.log('Total HTML:', html.length);
  
  // Compte les <style> tags
  const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  console.log('Total <style> tags:', styleMatches.length);
  styleMatches.forEach((s, i) => console.log(`  Style #${i}: ${s.length} chars`));
  
  // Compte les <link rel="stylesheet">
  const linkMatches = html.match(/<link[^>]+stylesheet[^>]*>/gi) || [];
  console.log('Total <link stylesheet>:', linkMatches.length);
  linkMatches.slice(0, 5).forEach((l, i) => console.log(`  Link #${i}: ${l.slice(0, 150)}`));
  
  // Cherche les classes styled-components dans le <head>
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    console.log('\nHEAD size:', headMatch[1].length);
    const scInHead = (headMatch[1].match(/\.sc-[a-zA-Z]+/g) || []).length;
    console.log('Occurrences ".sc-" dans HEAD:', scInHead);
  }
});

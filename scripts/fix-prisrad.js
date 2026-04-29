const fs = require('fs');
const files = [
  'C:/Users/Chriiss1997/Desktop/Billiga Pizzor - Live/karta.html',
  'C:/Users/Chriiss1997/Desktop/Billiga Pizzor - Live/www/karta.html'
];

// Use a regex so line endings don't matter
const RE = /var prisRad = obj\.prisNiva\s*\? '<div class="karta-popup-prisrad">' \+\s*'<span class="karta-popup-prisbubbla karta-popup-prisbubbla--' \+ \(obj\.prisNiva \|\| 'level3'\) \+ '">' \+ prisNivaLabel\(obj\.prisNiva\) \+ '<\/span>' \+\s*\(!obj\.oppettider && franPrisTxt \? '<span class="karta-popup-franpris">' \+ franPrisTxt \+ '<\/span>' : ''\) \+\s*'<\/div>'\s*: \(!obj\.oppettider && franPrisTxt \? '<p class="karta-popup-snitt">' \+ franPrisTxt \+ '<\/p>' : ''\);/;

const NEW = [
  "var aktuellNiva = obj.prisNiva || 'level3';",
  "        if (visaPrisTyp === 'snitt' && obj.snittPris) {",
  "          var sn = snittPrisNiva(obj.snittPris);",
  "          aktuellNiva = sn > 0 ? ('level' + Math.min(sn, 5)) : 'level3';",
  "        }",
  "        var prisRad = aktuellNiva",
  "          ? '<div class=\"karta-popup-prisrad\">' +",
  "              '<span class=\"karta-popup-prisbubbla karta-popup-prisbubbla--' + aktuellNiva + '\">' + prisNivaLabel(aktuellNiva) + '</span>' +",
  "              (!obj.oppettider && franPrisTxt ? '<span class=\"karta-popup-franpris\">' + franPrisTxt + '</span>' : '') +",
  "            '</div>'",
  "          : (!obj.oppettider && franPrisTxt ? '<p class=\"karta-popup-snitt\">' + franPrisTxt + '</p>' : '');"
].join('\r\n');

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  if (!RE.test(c)) { console.log('MISS: ' + f); continue; }
  fs.writeFileSync(f, c.replace(RE, NEW), 'utf8');
  console.log('OK: ' + f);
}

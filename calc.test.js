/*
  calc.test.js — self-testy pro calc.js
  Spouštění: node calc.test.js
  Bez závislostí, žádný framework — jednoduché assert().
*/

const assert = require("assert");
const { computeMetrics, DEFAULT_CONFIG } = require("./calc.js");

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`OK   ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(`     ${err.message}`);
    process.exitCode = 1;
  }
}

const cfg = { ...DEFAULT_CONFIG, commRate: 30, baseFull: 1000, baseHalf: 500 };

check("vysoká tržba použije procentuální provizi", () => {
  const m = computeMetrics(
    { kmStart: 1000, kmEnd: 1200, trzba: 6000, pristavne: 0, palivo: 500, myti: 0, jine: 0, kartou: 1000, fakturou: 0, iacCount: 0, shkmCount: 0, shift: "den" },
    cfg
  );
  assert.strictEqual(m.usesPercentage, true);
  assert.strictEqual(m.vyplata, 1800); // 30 % z 6000
  assert.strictEqual(m.companyOwes, false);
});

check("nízká tržba pod minimem vygeneruje doplatek", () => {
  const m = computeMetrics(
    { kmStart: 1000, kmEnd: 1200, trzba: 1500, pristavne: 0, palivo: 0, myti: 0, jine: 0, kartou: 0, fakturou: 0, iacCount: 0, shkmCount: 0, shift: "den" },
    cfg
  );
  assert.strictEqual(m.vyplata, 1000); // fix, protože 30 % z 1500 < 1000
  assert.strictEqual(m.doplatek, 1500); // minTrzba (3000) - trzba (1500)
  assert.strictEqual(m.nedoplatek, true);
});

check("směna hodně kryta smluvními jízdami (IAC/SHKM) může vést k tomu, že firma řidiči dorovnává", () => {
  const m = computeMetrics(
    { kmStart: 1000, kmEnd: 1020, trzba: 500, pristavne: 0, palivo: 0, myti: 0, jine: 0, kartou: 0, fakturou: 0, iacCount: 1, shkmCount: 0, shift: "den" },
    cfg
  );
  // fixní odměna (1000) je vyšší než reálně vybraná tržba (500) => settlement < 0
  assert.strictEqual(m.companyOwes, true);
  assert.strictEqual(m.settlementAbs, 500);
});

check("kontrola hotovosti: přebytek (dýško) se počítá kladně", () => {
  const m = computeMetrics(
    { kmStart: 1000, kmEnd: 1100, trzba: 3000, pristavne: 200, palivo: 300, myti: 0, jine: 0, kartou: 500, fakturou: 0, iacCount: 0, shkmCount: 0, shift: "den", hasCashActual: true, cashActual: 2500 },
    cfg
  );
  assert.strictEqual(m.cashExpected, 2200);
  assert.strictEqual(m.cashDiff, 300);
});

check("přístavné se nepočítá do provize, ale zůstává v částce k odevzdání", () => {
  const withPristavne = computeMetrics(
    { kmStart: 0, kmEnd: 100, trzba: 2000, pristavne: 300, palivo: 0, myti: 0, jine: 0, kartou: 0, fakturou: 0, iacCount: 0, shkmCount: 0, shift: "den" },
    cfg
  );
  const withoutPristavne = computeMetrics(
    { kmStart: 0, kmEnd: 100, trzba: 2000, pristavne: 0, palivo: 0, myti: 0, jine: 0, kartou: 0, fakturou: 0, iacCount: 0, shkmCount: 0, shift: "den" },
    cfg
  );
  assert.strictEqual(withPristavne.netto, 1700);
  // "trzba" (ne netto) jde do kOdevzdani, takže přístavné v ní zůstává
  assert.strictEqual(withPristavne.kOdevzdani, withoutPristavne.kOdevzdani);
});

check("konfigurovatelné konstanty (minTrzbaPerKm) ovlivní výpočet", () => {
  const customCfg = { ...cfg, minTrzbaPerKm: 20 };
  const m = computeMetrics(
    { kmStart: 0, kmEnd: 100, trzba: 1000, pristavne: 0, palivo: 0, myti: 0, jine: 0, kartou: 0, fakturou: 0, iacCount: 0, shkmCount: 0, shift: "den" },
    customCfg
  );
  assert.strictEqual(m.minTrzba, 2000); // 100 km * 20 Kč
});

check("smluvní km nikdy nejdou do záporných účtovaných km", () => {
  const m = computeMetrics(
    { kmStart: 0, kmEnd: 10, trzba: 500, pristavne: 0, palivo: 0, myti: 0, jine: 0, kartou: 0, fakturou: 0, iacCount: 5, shkmCount: 5, shift: "den" },
    cfg
  );
  assert.strictEqual(m.chargedKm, 0);
  assert.ok(m.chargedKm >= 0);
});

console.log(`\n${passed} test(y) prošlo bez chyby.`);

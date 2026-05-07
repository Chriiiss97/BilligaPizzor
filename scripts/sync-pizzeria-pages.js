const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const dataPath = path.join(projectRoot, 'data', 'pizzor.json');
const templatePath = path.join(projectRoot, 'pizzerior', 'pizzeria.html');
const outputDir = path.join(projectRoot, 'pizzerior');

function normalizePizzeriaName(name) {
  return String(name || '').toLowerCase().trim();
}

function createPizzeriaSlug(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(pizzeria|restaurang|resturang)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'pizzeria';
}

function getUniquePizzerias(rows) {
  const infoByName = new Map();

  rows.forEach((row) => {
    const key = normalizePizzeriaName(row.pizzeria);
    if (!key || infoByName.has(key)) return;
    infoByName.set(key, {
      name: row.pizzeria || '',
    });
  });

  const slugUsage = new Map();

  return Array.from(infoByName.values()).map((entry) => {
    const baseSlug = createPizzeriaSlug(entry.name);
    const used = slugUsage.get(baseSlug) || 0;
    const slug = used === 0 ? baseSlug : `${baseSlug}-${used + 1}`;
    slugUsage.set(baseSlug, used + 1);

    return {
      name: entry.name,
      slug,
      fileName: `${slug}.html`,
    };
  });
}

function main() {
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Missing data file: ${dataPath}`);
  }
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing template file: ${templatePath}`);
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const rows = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const uniquePizzerias = getUniquePizzerias(rows);
  const templateContent = fs.readFileSync(templatePath, 'utf8');

  let createdCount = 0;

  uniquePizzerias.forEach((entry) => {
    const filePath = path.join(outputDir, entry.fileName);
    if (fs.existsSync(filePath)) return;
    fs.writeFileSync(filePath, templateContent, 'utf8');
    createdCount += 1;
  });

  console.log(`Pizzeria pages sync complete. Unique pizzerias: ${uniquePizzerias.length}. Created: ${createdCount}.`);
}

main();

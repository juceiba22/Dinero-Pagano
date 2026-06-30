const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
const envPath = path.join(__dirname, '.env');

console.log('--- Configurando base de datos para SQLite ---');

if (fs.existsSync(schemaPath)) {
  let schema = fs.readFileSync(schemaPath, 'utf8');

  // Replace provider
  schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
  // Replace database URL source to use file
  schema = schema.replace(/url\s*=\s*env\("DATABASE_URL"\)/g, 'url = "file:./dev.db"');
  // Remove PostgreSQL Decimal precision annotations (not supported natively by SQLite)
  schema = schema.replace(/@db\.Decimal\(\d+,\s*\d+\)/g, '');

  fs.writeFileSync(schemaPath, schema, 'utf8');
  console.log('[OK] schema.prisma modificado para SQLite.');
} else {
  console.error('[Error] No se encontró schema.prisma');
}

if (fs.existsSync(envPath)) {
  let env = fs.readFileSync(envPath, 'utf8');
  // Update DATABASE_URL line
  env = env.replace(/DATABASE_URL=".*"/g, 'DATABASE_URL="file:./dev.db"');
  fs.writeFileSync(envPath, env, 'utf8');
  console.log('[OK] Archivo .env actualizado con DATABASE_URL de SQLite.');
} else {
  console.error('[Warning] No se encontró el archivo .env, saltando.');
}

console.log('\n¡Listo! Ahora puedes correr:');
console.log('  npm run prisma:generate');
console.log('  npm run prisma:migrate');
console.log('  npm run prisma:seed');
console.log('  npm run dev');

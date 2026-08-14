const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const serverFile = path.join(projectRoot, 'src', 'server.js');
const routesDir = path.join(projectRoot, 'src', 'routes');
const outFile = path.join(projectRoot, '..', 'docs', '05_API_DOCUMENTATION.md');

function readServerMounts() {
  const content = fs.readFileSync(serverFile, 'utf8');
  const regex = /app\.use\('\/api([\w\-\/_]*)',\s*require\('\.\/routes\/(.+?)'\)\);/g;
  const matches = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    const mount = m[1] || '';
    const routeFile = m[2];
    matches.push({ mount: '/api' + mount, routeFile });
  }
  return matches;
}

function parseRouteFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split(/\r?\n/);
  const endpoints = [];

  const methodRegex = /router\.(get|post|put|delete|patch|options)\s*\(\s*['"`]([^'"`]+)['"`]/i;
  const routeChainRegex = /router\.route\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.([a-z\.()\s,]+)/i;

  for (const line of lines) {
    const m = methodRegex.exec(line);
    if (m) {
      endpoints.push({ method: m[1].toUpperCase(), path: m[2] });
      continue;
    }
    const r = routeChainRegex.exec(line);
    if (r) {
      const pathStr = r[1];
      const chain = r[2];
      const methods = [];
      const methodNames = chain.split('.').map(s => s.trim()).filter(Boolean);
      for (const part of methodNames) {
        const name = part.split('(')[0];
        if (['get','post','put','delete','patch','options'].includes(name)) methods.push(name.toUpperCase());
      }
      for (const mname of methods) endpoints.push({ method: mname, path: pathStr });
    }
  }
  return endpoints;
}

function generate() {
  const mounts = readServerMounts();
  const md = [];
  md.push('# 05_API_DOCUMENTATION');
  md.push('');
  md.push('Generated API reference from backend route files.');
  md.push('');

  for (const mount of mounts) {
    const routePath = path.join(routesDir, mount.routeFile + '.js');
    const endpoints = parseRouteFile(routePath);
    md.push(`## ${mount.mount}  (from \\backend/src/routes/${mount.routeFile}.js)`);
    md.push('');
    if (endpoints.length === 0) {
      md.push('_No explicit router methods found or file missing._');
      md.push('');
      continue;
    }
    md.push('| Method | Path |');
    md.push('|--------|------|');
    endpoints.forEach(e => {
      md.push(`| ${e.method} | ${mount.mount}${e.path.startsWith('/')? e.path : '/' + e.path} |`);
    });
    md.push('');
  }

  fs.writeFileSync(outFile, md.join('\n'));
  console.log('API documentation generated to', outFile);
}

try { generate(); } catch (e) { console.error(e); process.exit(1); }

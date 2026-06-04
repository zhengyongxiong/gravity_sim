import './core.test.js';
import './app.test.js';

const results = globalThis.__tests ?? [];
const failures = results.filter((result) => !result.ok);

for (const result of results) {
  const marker = result.ok ? 'PASS' : 'FAIL';
  console.log(`${marker} ${result.name}`);
  if (!result.ok) {
    console.log(result.error?.stack ?? result.error);
  }
}

if (failures.length > 0) {
  console.error(`${failures.length}/${results.length} tests failed`);
  process.exit(1);
}

console.log(`${results.length}/${results.length} tests passed`);

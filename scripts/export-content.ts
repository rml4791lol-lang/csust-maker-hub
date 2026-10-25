import { writeFileSync } from 'node:fs';
import { items } from '../src/data/items';

writeFileSync('content/items.json', JSON.stringify(items, null, 2) + '\n', 'utf8');
console.log('exported', items.length, 'items -> content/items.json');

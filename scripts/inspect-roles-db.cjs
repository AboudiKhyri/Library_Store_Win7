const path = require('path');
const dbPath = path.resolve(__dirname, '../data/custom.db');
const Database = require('../server/node_modules/better-sqlite3');
const db = new Database(dbPath);

console.log('--- Current Roles in custom.db ---');
const roles = db.prepare('SELECT id, key, nameAr, nameEn, isSystem FROM Role').all();
console.table(roles);

console.log('--- Current Users and their Roles ---');
const users = db.prepare('SELECT id, username, displayName, roleKey, active FROM User').all();
console.table(users);
